import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface ChatMessage {
  id: string;
  text: string;
  userId: string;
  userName: string;
  role: string;
  createdAt: string;
}

interface ChatState {
  messages: ChatMessage[];
}

const initialState: ChatState = {
  messages: [],
};

const chatSlice = createSlice({
  name: 'chat',
  initialState,
  reducers: {
    addChatMessage(state, action: PayloadAction<ChatMessage>) {
      state.messages.push(action.payload);
    },
    clearChatMessages(state) {
      state.messages = [];
    },
  },
});

export const { addChatMessage, clearChatMessages } = chatSlice.actions;
export default chatSlice.reducer;
