import dotenv from "dotenv";
import express from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import bcrypt from "bcryptjs";

dotenv.config();

const seedAdmin = async () => {
  try {
    await mongoose.connection(process.env.MONGO_URI);
    console.log("MongoDb bağlantısı başarılı.");

    // admin var mı
    const existingAdmin = await User.findOne({ role: "admin" });

    if (existingAdmin) {
      console.log("Admin zaten mevcut.");
      process.exit(0);
    }

    const hashedPassword = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);

    await User.create({
      username: process.env.ADMIN_USERNAME,
      password: hashedPassword,
      email: "admin@samsun.edu.tr",
      role: "admin",
    });

    console.log("Admin oluşturuldu.");
    process.exit(0);
  } catch (error) {
    console.error("Hata : " + error.message);
    process.exit(1);
  }
};

seedAdmin();
