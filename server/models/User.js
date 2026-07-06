import mongoose from "mongoose";

const userSchema = mongoose.Schema(
  {
    clerkId: {
      type: String,
      required: true,
      unique: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
    },
    firstName: {
      type: String,
      default: "",
    },
    lastName: {
      type: String,
      default: "",
    },
    role: {
      type: String,
      enum: ["admin", "student"],
      default: "student",
    },
  },
  { timestamps: true },
);

export default mongoose.model("User", userSchema);

/* 
User Model
  - clerkId
  - email
  - firstName
  - lastName
  - role : default Student
  - createdAt , updatedAt ( timestamps )
*/
