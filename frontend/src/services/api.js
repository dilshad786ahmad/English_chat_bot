import axios from 'axios';

const API_BASE_URL = 'https://english-chat-bot-8vdv.onrender.com';



export const notifySessionExpired = () => {
  window.dispatchEvent(new Event('auth:session-expired'));
};

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30s timeout
});

// ─────────────────────────────────────────
// Request Interceptor: Auto-attach JWT token
// ─────────────────────────────────────────
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('dark_ai_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const requestUrl = error.config?.url || '';
    const isAuthSubmission = /^\/auth\/(login|register|google)(?:\/|$)/.test(requestUrl);
    if (error.response?.status === 401 && localStorage.getItem('dark_ai_token') && !isAuthSubmission) {
      notifySessionExpired();
    }
    return Promise.reject(error);
  }
);

/**
 * Send a message to the AI English Chatbot
 * @param {string} prompt - User's input message
 * @param {string} sessionId - Active session ID
 * @param {(token: string) => void} onToken - Called as each response token arrives
 * @returns {Promise<void>}
 */
export const sendChatMessage = async (prompt, sessionId, onToken) => {
  const headers = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('dark_ai_token');
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${API_BASE_URL}/chatgroq`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ prompt, sessionId }),
    });
  } catch (error) {
    console.error('API Error:', error);
    throw new Error(
      error.message || 'Unable to connect to the backend server. Please make sure backend is running on port 8000.'
    );
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const error = new Error(
      errorData?.message ||
        `Request failed with status code ${response.status}`
    );
    error.status = response.status;
    if (response.status === 401 && token) notifySessionExpired();
    throw error;
  }

  if (!response.body) {
    throw new Error('The backend did not provide a streaming response.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let completed = false;

  const handleEvent = (event) => {
    const dataLine = event
      .split(/\r?\n/)
      .find((line) => line.startsWith('data:'));
    if (!dataLine) return;

    const data = JSON.parse(dataLine.slice(5).trim());
    if (data.token) onToken?.(data.token);
    if (data.error) throw new Error(data.error);
    if (data.done) completed = true;
  };

  try {
    while (true) {
      const { value, done } = await reader.read();
      buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
      const events = buffer.split(/\r?\n\r?\n/);
      buffer = events.pop() || '';
      events.forEach(handleEvent);
      if (done) break;
    }

    if (buffer.trim()) handleEvent(buffer);
    if (!completed) throw new Error('The response stream ended before completion.');
  } catch (error) {
    await reader.cancel().catch(() => {});
    throw error;
  }
};

/**
 * Fetch chat history for a session from MongoDB
 * @param {string} sessionId
 * @returns {Promise<Array<{role: string, content: string, createdAt: string}>>}
 */
export const fetchChatHistory = async (sessionId) => {
  try {
    const response = await apiClient.get(`/history/${sessionId}`);
    return response.data?.history || [];
  } catch (error) {
    console.warn('Could not load history:', error.message);
    return [];
  }
};

/**
 * Clear chat history for a session
 * @param {string} sessionId
 */
export const clearChatHistory = async (sessionId) => {
  try {
    const response = await apiClient.delete(`/history/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Could not clear history:', error.message);
    throw error;
  }
};

export const fetchLearningProfile = async () => {
  const response = await apiClient.get('/learning/profile');
  return response.data?.profile || null;
};

export const saveLearningProfile = async (profile) => {
  const response = await apiClient.put('/learning/profile', profile);
  return response.data.profile;
};

export const fetchTeleprompterScripts = async () => {
  const response = await apiClient.get('/teleprompter/scripts');
  return response.data.scripts;
};

export const saveTeleprompterScript = async (script) => {
  const response = await apiClient.post('/teleprompter/scripts', script);
  return response.data.scripts;
};

export const updateTeleprompterScript = async (scriptId, script) => {
  const response = await apiClient.put(`/teleprompter/scripts/${scriptId}`, script);
  return response.data.scripts;
};

export const deleteTeleprompterScript = async (scriptId) => {
  const response = await apiClient.delete(`/teleprompter/scripts/${scriptId}`);
  return response.data.scripts;
};

export const analyzeChatImage = async (prompt, sessionId, image) => {
  const response = await apiClient.post(
    '/chat-image',
    { prompt, sessionId, image },
    { timeout: 120000 }
  );
  return response.data;
};

export default apiClient;
