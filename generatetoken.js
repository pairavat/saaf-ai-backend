// // run this in a small script or Node REPL
// import { generateToken } from "./utils/jwt.js";

// const token = generateToken({
//   id: 1,         // example user id
//   email: "test@example.com",
//   role: "admin"
// });

// console.log(token);

// import { generateToken } from "./utils/jwt.js";
// import { generateToken } from "./utils/jwt.js";

// const token = generateToken({ userId: 123 });
// console.log("Generated Token:", token);


// generatetoken.js
import { generateToken } from "./utils/jwt.js";

const token = generateToken({
  id: 1,
  email: "test@example.com",
  role: "admin",
});

console.log("Generated Token:", token);
