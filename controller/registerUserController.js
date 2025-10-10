// controller/registeredUsersController.js
import prisma from '../config/prismaClient.mjs';

// Get all registered users (admin only)
export const getAllRegisteredUsers = async (req, res) => {
    try {
        const { company_id } = req.query;
        const whereClause = {};

        if (company_id && company_id !== 'undefined' && company_id !== 'null') {
            whereClause.company_id = BigInt(company_id);
        }

        const registeredUsers = await prisma.registered_users.findMany({
            where: whereClause,
            include: {
                companies: {
                    select: { id: true, name: true }
                },
                role: {
                    select: { id: true, name: true, description: true }
                }
            },
            orderBy: { created_at: 'desc' }
        });

        res.status(200).json({
            success: true,
            data: registeredUsers.map(user => ({
                ...user,
                id: user.id.toString(),
                company_id: user.company_id.toString()
            }))
        });
    } catch (error) {
        console.error('Error fetching registered users:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// Create new registered user (admin only)
export const createRegisteredUser = async (req, res) => {
    try {
        const { company_id, name, phone, role_id } = req.body;

        // Validate required fields
        if (!company_id || !name || !phone || !role_id) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required: company_id, name, phone, role_id'
            });
        }

        // Check if phone already exists
        const existingUser = await prisma.registered_users.findUnique({
            where: { phone }
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                error: 'Phone number already registered'
            });
        }

        // Validate role exists
        const role = await prisma.role.findUnique({
            where: { id: parseInt(role_id) }
        });

        if (!role) {
            return res.status(400).json({
                success: false,
                error: 'Invalid role selected'
            });
        }

        const registeredUser = await prisma.registered_users.create({
            data: {
                company_id: BigInt(company_id),
                name: name.trim(),
                phone: phone.trim(),
                role_id: parseInt(role_id)
            },
            include: {
                companies: {
                    select: { id: true, name: true }
                },
                role: {
                    select: { id: true, name: true, description: true }
                }
            }
        });

        // TODO: Send SMS with registration link (implement SMS service)

        res.status(201).json({
            success: true,
            message: 'Registered user created successfully',
            data: {
                ...registeredUser,
                id: registeredUser.id.toString(),
                company_id: registeredUser.company_id.toString()
            }
        });
    } catch (error) {
        console.error('Error creating registered user:', error);

        // Handle specific Prisma errors
        if (error.code === 'P2002') {
            return res.status(400).json({
                success: false,
                error: 'Phone number already exists'
            });
        }

        if (error.code === 'P2003') {
            return res.status(400).json({
                success: false,
                error: 'Invalid company or role reference'
            });
        }

        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// Generate simple verification token without crypto
const generateVerificationToken = () => {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
};

// Verify phone and check if user can proceed to set password
export const verifyPhone = async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || phone.trim() === '') {
            return res.status(400).json({
                success: false,
                error: 'Phone number is required'
            });
        }

        const registeredUser = await prisma.registered_users.findUnique({
            where: { phone: phone.trim() },
            include: {
                companies: {
                    select: { id: true, name: true }
                },
                role: {
                    select: { id: true, name: true, description: true }
                }
            }
        });

        if (!registeredUser) {
            return res.status(404).json({
                success: false,
                error: 'Phone number not found in registered users'
            });
        }

        // Check if already has account in users table
        const existingAccount = await prisma.users.findUnique({
            where: { phone: phone.trim() }
        });

        if (existingAccount) {
            return res.status(400).json({
                success: false,
                error: 'Account already exists. Please login instead.'
            });
        }

        // Generate verification token using simple method
        const verificationToken = generateVerificationToken();

        await prisma.registered_users.update({
            where: { phone: phone.trim() },
            data: {
                verification_token: verificationToken,
                updated_at: new Date()
            }
        });

        res.status(200).json({
            success: true,
            data: {
                id: registeredUser.id.toString(),
                name: registeredUser.name,
                phone: registeredUser.phone,
                role: registeredUser.role,
                company: registeredUser.companies,
                verification_token: verificationToken
            }
        });
    } catch (error) {
        console.error('Error verifying phone:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};

// Set password and create user account
export const setPassword = async (req, res) => {
    try {
        const { verification_token, password, confirm_password } = req.body;

        // Validate required fields
        if (!verification_token || !password || !confirm_password) {
            return res.status(400).json({
                success: false,
                error: 'All fields are required'
            });
        }

        if (password !== confirm_password) {
            return res.status(400).json({
                success: false,
                error: 'Passwords do not match'
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                error: 'Password must be at least 6 characters'
            });
        }

        // Find registered user by verification token
        const registeredUser = await prisma.registered_users.findUnique({
            where: { verification_token },
            include: {
                role: true
            }
        });

        if (!registeredUser) {
            return res.status(400).json({
                success: false,
                error: 'Invalid verification token'
            });
        }

        // Store password as plain text (NOT RECOMMENDED FOR PRODUCTION)
        // In production, always hash passwords using bcrypt or similar
        const plainTextPassword = password;

        // Create user account with role_id from registered_user
        const newUser = await prisma.users.create({
            data: {
                name: registeredUser.name,
                phone: registeredUser.phone,
                password: plainTextPassword, // Plain text password - ONLY FOR DEVELOPMENT
                company_id: registeredUser.company_id,
                role_id: registeredUser.role_id
            }
        });

        // Mark registered user as verified
        await prisma.registered_users.update({
            where: { verification_token },
            data: {
                is_verified: true,
                updated_at: new Date()
            }
        });

        res.status(201).json({
            success: true,
            message: 'Account created successfully',
            data: {
                id: newUser.id.toString(),
                name: newUser.name,
                phone: newUser.phone,
                role_id: newUser.role_id,
                company_id: newUser.company_id.toString()
            }
        });
    } catch (error) {
        console.error('Error setting password:', error);
        res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
};
