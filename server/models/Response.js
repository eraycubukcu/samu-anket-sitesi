import mongoose from "mongoose";

const answerSchema = mongoose.Schema({
  questionId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  answer: {
    type: mongoose.Schema.Types.Mixed,
    required: true,
  },
});

const responseSchema = mongoose.Schema(
  {
    survey: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Survey",
      required: true,
    },
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    answers: {
      type: [answerSchema],
      required: true,
    },
  },
  { timestamps: true },
);

// Bir öğrenci aynı ankete iki kere cevap veremesin
responseSchema.index({ survey: 1, user: 1 }, { unique: true });

export default mongoose.model("Response", responseSchema);

/* 
Response
  - Survey : hangi anket olduğu
  - User : hangi user olduğu
  - answers : answerSchema bilgileri

Answer Schema
  - questionId 
  - answer
*/
