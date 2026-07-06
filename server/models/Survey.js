import mongoose from "mongoose";

const questionSchema = mongoose.Schema({
  questionText: {
    type: String,
    required: true,
  },
  questionType: {
    type: String,
    enum: ["radio", "text", "checkbox", "rating"],
    required: true,
  },
  options: {
    type: [String],
    default: [],
  },
  required: {
    type: Boolean,
    default: true,
  },
});

const surveySchema = mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      unique: true,
    },
    description: {
      type: String,
      default: "",
    },
    questions: {
      type: [questionSchema],
      validate: {
        validator: (arr) => arr.length > 0,
        message: "En az bir soru olmalı.",
      },
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isActive: {
      type: Boolean,
      required: true,
    },
    startDate: {
      type: Date,
    },
    endDate: {
      type: Date,
    },
  },
  { timestamps: true },
);

export default mongoose.model("Survey", surveySchema);

/* 
Survey Modeli
 - Title
 - Description
 - Questions
 - createdBy 
 - isActive
 - startDate
 - endDate
 - createdAt, updatedAt (timestamps)
*/

/* 
Question Schema
 - questionText
 - questionType
 - options -> örneğin type radio seçildi radio'nun seçeneklerini tutuyor.
 - required -> alanın doldurulup doldurulmaması ( bu aslında hepsi true olcak )
*/ 