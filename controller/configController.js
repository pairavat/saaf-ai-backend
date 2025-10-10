import prisma from "../config/prismaClient.mjs";

// '/api/configurations/:name'
// controller/configController.js
function convertBigInts(obj) {
  if (Array.isArray(obj)) {
    return obj.map(convertBigInts);
  } else if (obj && typeof obj === "object") {
    return Object.fromEntries(
      Object.entries(obj).map(([key, value]) => [
        key,
        typeof value === "bigint" ? value.toString() : convertBigInts(value),
      ])
    );
  } else {
    return obj;
  }
}

// Get configuration by Id
export async function getConfigurationById(req, res) {
  const { id } = req.params;
  if (!id) {
    return res.status(400).json({
      status: "error",
      message: "Missing 'id' in request parameters.",
    });
  }

  try {
    const config = await prisma.configurations.findUnique({
      where: {
        id: BigInt(id),
      },
    });

    if (!config) {
      return res.status(404).json({
        status: "error",
        message: `Configuration with id '${id}' not found.`,
      });
    }

    const safeConfig = convertBigInts(config);

    res.json({
      status: "success",
      data: safeConfig,
      message: "Data retrived Sucessfully !",
    });
  } catch (error) {
    console.error("Error fetching configuration:", error);
    res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}

// get the cofiguration by name
export async function getConfigurationByName(req, res) {
  console.log('Get config by name')
  const { name } = req.params;
  console.log(name, "name from the request");

  if (!name) {
    return res.status(400).json({
      status: "error",
      message: "Missing 'name' in request parameters.",
    });
  }

  try {
    console.log(`Fetching configuration with name: ${name}`);

    const config = await prisma.configurations.findMany({
      where: {
        name: name,
      },
    });

    if (!config) {
      return res.status(404).json({
        status: "error",
        message: `Configuration with name '${name}' not found.`,
      });
    }

    const safeConfig = convertBigInts(config);

    res.json({
      status: "success",
      data: safeConfig,
      message: "Data retrived Sucessfully !",
    });
  } catch (error) {
    console.error("Error fetching configuration:", error);
    res
      .status(500)
      .json({ status: "error", message: "Internal server error." });
  }
}
