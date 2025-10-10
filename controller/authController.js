import prisma from "../config/prismaClient.mjs";
import bcrypt from "bcryptjs";

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
  const { phone, password } = req.body;

  if (!phone || !password) {
    return res.status(400).json({ error: "Phone and password are required." });
  }

  try {
    const user = await prisma.users.findUnique({
      where: { phone },
    });
    // const user = await prisma.users.findUnique({ where: { phone } });
    console.log("user", user);
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
        token:
          "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6MSwiZW1haWwiOiJ0ZXN0QGV4YW1wbGUuY29tIiwicm9sZSI6ImFkbWluIn0.X-gpybmE2KFZNPQqEY05FV70eXY4ypXHmmdDhyK0V6I",
      },
    });
  } catch (err) {
    console.error("Login Error:", err);
    res.status(500).json({ error: "Login failed." });
  }
};
