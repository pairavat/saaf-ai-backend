import prisma from "../config/prismaClient.mjs";
import bcrypt from "bcryptjs";
import { generateToken } from "../utils/jwt.js";

export const registerUser = async (req, res) => {
  const { name, email, phone, password, role_id, company_id, age, birthdate } =
    req.body;

  if (!phone || !password) {
    return res.status(400).json({
      error: " Phone, and Password fields are required.",
    });
  }

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const existing_user = await prisma.users.findUnique({
      where: { phone },
    });

    if (existing_user) {
      return res.status(409).json({
        status: "error",
        message: "Phone No. already exists, please try another one!",
      });
    }

    // Build the base data object
    const data = {
      name,
      email,
      phone,
      password: hashedPassword,
      role_id: role_id || null,
      age: age || null,
      birthdate: birthdate || null,
    };

    // Conditionally add relation
    if (company_id) {
      data.companies = { connect: { id: company_id } };
    }

    // Create the user with full data
    const user = await prisma.users.create({ data });

    res.status(201).json({
      message: "User registered",
      userId: user.id.toString(),
    });
  } catch (err) {
    console.error("Registration Error:", err);
    res.status(500).json({ error: "User registration failed." });
  }
};

export const loginUser = async (req, res) => {
  console.log("in login controller");
  const { phone, password, fcm_token } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password are required." });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { phone },
    });

    // const user = await prisma.users.findUnique({ where: { phone } });
    console.log("user", user);

    const serializeUser = {
      ...user,
      id: user?.id?.toString(),
      company_id: user?.id?.toString(),
    };
    if (!user) {
      return res
        .status(404)
        .json({ error: "error", message: "User not Found!" });
    } else if (!user.phone) {
      return res.status(404).json({
        status: "error",
        message: "User does not exist !",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res
        .status(401)
        .json({ status: "error", message: "Password does not match !" });
    }

    const token = generateToken({
      id: serializeUser.id,
      email: user.email,
      role_id: user.role_id,
      company_id: serializeUser.company_id,
    });

    const updateUserToke = await prisma.users.update({
      where: {
        id: serializeUser?.id,
      },
      data: {
        token: token,
        fcm_token: fcm_token,
      },
    });

    console.log(updateUserToke, "update user");
    // For simplicity, return basic info (in production use JWT)
    res.json({
      status: "success",
      message: "Login successful",
      user: {
        id: user.id.toString(), // Convert BigInt to string
        name: user.name,
        email: user.email,
        phone: user.phone,
        age: user.age,
        role_id: user.role_id,
        company_id: user.company_id.toString(),
        token: token,
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed." });
  }
};
