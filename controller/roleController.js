import prisma from "../config/prismaClient.mjs";

export const getRole = async (req, res) => {

    try {
        const data = await prisma.role.findMany();
        console.log(data, "data role");

        res.status(200).json({
            'success': true,
            data
        })
    }
    catch (err) {
        console.log(err, "error occured while fetching data from roles");
    }
}