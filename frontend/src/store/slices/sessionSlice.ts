import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import api from '../../services/api';

export interface Session {
  id: string;
  title: string;
  description: string | null;
  scheduledAt: string;
  startedAt: string | null;
  endedAt: string | null;
  livekitRoom: string;
  recordingUrl: string | null;
  hlsUrl: string | null;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  createdAt: string;
  _count?: { attendance: number; questions: number };
}

interface SessionState {
  sessions: Session[];
  activeSession: Session | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: SessionState = {
  sessions: [],
  activeSession: null,
  isLoading: false,
  error: null,
};

// ── Async Thunks ───────────────────────────────────────────────────────────

export const fetchSessions = createAsyncThunk('sessions/fetchAll', async (_, { rejectWithValue }) => {
  try {
    const { data } = await api.get<Session[]>('/sessions');
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return rejectWithValue(error.response?.data?.error || 'Failed to fetch sessions');
  }
});

export const createSession = createAsyncThunk(
  'sessions/create',
  async (payload: { title: string; description?: string; scheduledAt: string }, { rejectWithValue }) => {
    try {
      const { data } = await api.post<Session>('/sessions', payload);
      return data;
    } catch (err: unknown) {
      const error = err as { response?: { data?: { error?: string } } };
      return rejectWithValue(error.response?.data?.error || 'Failed to create session');
    }
  }
);

export const startSession = createAsyncThunk('sessions/start', async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await api.put<Session>(`/sessions/${id}/start`);
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return rejectWithValue(error.response?.data?.error || 'Failed to start session');
  }
});

export const endSession = createAsyncThunk('sessions/end', async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await api.put<Session>(`/sessions/${id}/end`);
    return data;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return rejectWithValue(error.response?.data?.error || 'Failed to end session');
  }
});

export const deleteSession = createAsyncThunk('sessions/delete', async (id: string, { rejectWithValue }) => {
  try {
    await api.delete(`/sessions/${id}`);
    return id;
  } catch (err: unknown) {
    const error = err as { response?: { data?: { error?: string } } };
    return rejectWithValue(error.response?.data?.error || 'Failed to delete session');
  }
});

// ── Slice ──────────────────────────────────────────────────────────────────

const sessionSlice = createSlice({
  name: 'sessions',
  initialState,
  reducers: {
    setActiveSession(state, action: PayloadAction<Session | null>) {
      state.activeSession = action.payload;
    },
    updateSession(state, action: PayloadAction<Session>) {
      const idx = state.sessions.findIndex((s) => s.id === action.payload.id);
      if (idx !== -1) state.sessions[idx] = action.payload;
      if (state.activeSession?.id === action.payload.id) {
        state.activeSession = action.payload;
      }
    },
    clearError(state) {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // fetchSessions
      .addCase(fetchSessions.pending, (state) => { state.isLoading = true; state.error = null; })
      .addCase(fetchSessions.fulfilled, (state, action) => {
        state.isLoading = false;
        state.sessions = action.payload;
      })
      .addCase(fetchSessions.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload as string;
      })
      // createSession
      .addCase(createSession.fulfilled, (state, action) => {
        state.sessions.unshift(action.payload);
      })
      .addCase(createSession.rejected, (state, action) => {
        state.error = action.payload as string;
      })
      // startSession / endSession
      .addCase(startSession.fulfilled, (state, action) => {
        const idx = state.sessions.findIndex((s) => s.id === action.payload.id);
        if (idx !== -1) state.sessions[idx] = action.payload;
      })
      .addCase(endSession.fulfilled, (state, action) => {
        const idx = state.sessions.findIndex((s) => s.id === action.payload.id);
        if (idx !== -1) state.sessions[idx] = action.payload;
      })
      // deleteSession
      .addCase(deleteSession.fulfilled, (state, action) => {
        state.sessions = state.sessions.filter((s) => s.id !== action.payload);
      });
  },
});

export const { setActiveSession, updateSession, clearError } = sessionSlice.actions;
export default sessionSlice.reducer;
