import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface Question {
  id: string;
  text: string;
  answered: boolean;
  userId: string;
  sessionId: string;
  createdAt: string;
  user: { name: string };
}

interface QuestionState {
  questions: Question[];
  totalCount: number;
  unansweredCount: number;
}

const initialState: QuestionState = {
  questions: [],
  totalCount: 0,
  unansweredCount: 0,
};

const questionSlice = createSlice({
  name: 'questions',
  initialState,
  reducers: {
    setQuestions(state, action: PayloadAction<Question[]>) {
      state.questions = action.payload;
      state.totalCount = action.payload.length;
      state.unansweredCount = action.payload.filter((q) => !q.answered).length;
    },
    addQuestion(state, action: PayloadAction<Question>) {
      // Add to beginning (newest first)
      state.questions.unshift(action.payload);
      state.totalCount += 1;
      if (!action.payload.answered) state.unansweredCount += 1;
    },
    markQuestionAnswered(state, action: PayloadAction<string>) {
      const question = state.questions.find((q) => q.id === action.payload);
      if (question && !question.answered) {
        question.answered = true;
        state.unansweredCount = Math.max(0, state.unansweredCount - 1);
      }
    },
    removeQuestion(state, action: PayloadAction<string>) {
      const idx = state.questions.findIndex((q) => q.id === action.payload);
      if (idx !== -1) {
        const q = state.questions[idx];
        if (!q.answered) state.unansweredCount = Math.max(0, state.unansweredCount - 1);
        state.questions.splice(idx, 1);
        state.totalCount = Math.max(0, state.totalCount - 1);
      }
    },
    clearQuestions(state) {
      state.questions = [];
      state.totalCount = 0;
      state.unansweredCount = 0;
    },
  },
});

export const {
  setQuestions,
  addQuestion,
  markQuestionAnswered,
  removeQuestion,
  clearQuestions,
} = questionSlice.actions;

export default questionSlice.reducer;
