import swaggerJsdoc from "swagger-jsdoc";

const swaggerOptions: swaggerJsdoc.Options = {
  definition: {
    openapi: "3.0.0",
    info: {
      title: "E-Learning Platform API",
      version: "1.0.0",
      description:
        "API documentation for the modern dual-portal e-learning platform. " +
        "Supports Student, Teacher, and Admin roles with JWT-based authentication.",
      contact: {
        name: "API Support",
      },
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: "Development server",
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          description: "Enter your JWT token obtained from /api/auth/login",
        },
      },
      schemas: {
        User: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            name: { type: "string", example: "John Doe" },
            email: {
              type: "string",
              format: "email",
              example: "john@example.com",
            },
            role: {
              type: "string",
              enum: ["student", "teacher", "admin"],
              example: "student",
            },
            avatar: {
              type: "string",
              example: "",
            },
            isActive: {
              type: "boolean",
              example: true,
            },
            createdAt: {
              type: "string",
              format: "date-time",
              example: "2026-04-17T00:00:00.000Z",
            },
            updatedAt: {
              type: "string",
              format: "date-time",
              example: "2026-04-17T00:00:00.000Z",
            },
          },
        },
        RegisterRequest: {
          type: "object",
          required: ["name", "email", "password"],
          properties: {
            name: { type: "string", example: "John Doe" },
            email: {
              type: "string",
              format: "email",
              example: "john@example.com",
            },
            password: {
              type: "string",
              format: "password",
              minLength: 6,
              example: "securePassword123",
            },
            role: {
              type: "string",
              enum: ["student", "teacher"],
              default: "student",
              example: "student",
            },
          },
        },
        LoginRequest: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: {
              type: "string",
              format: "email",
              example: "john@example.com",
            },
            password: {
              type: "string",
              format: "password",
              example: "securePassword123",
            },
          },
        },
        AuthResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: true },
            data: {
              type: "object",
              properties: {
                user: { $ref: "#/components/schemas/User" },
                token: {
                  type: "string",
                  example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
                },
              },
            },
          },
        },
        ErrorResponse: {
          type: "object",
          properties: {
            success: { type: "boolean", example: false },
            message: { type: "string", example: "Error description" },
          },
        },
        StudentProfile: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            userId: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            enrolledCourses: {
              type: "array",
              items: { type: "string" },
              example: [],
            },
            wishlist: {
              type: "array",
              items: { type: "string" },
              example: [],
            },
            certificates: {
              type: "array",
              items: { type: "string" },
              example: [],
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        TeacherProfile: {
          type: "object",
          properties: {
            _id: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            userId: { type: "string", example: "664f1a2b3c4d5e6f7a8b9c0d" },
            headline: {
              type: "string",
              example: "Senior Software Engineer at Google",
            },
            bio: {
              type: "string",
              example:
                "10+ years building scalable systems. Passionate about teaching.",
            },
            socialLinks: {
              type: "object",
              properties: {
                linkedin: {
                  type: "string",
                  example: "https://linkedin.com/in/johndoe",
                },
                twitter: {
                  type: "string",
                  example: "https://twitter.com/johndoe",
                },
                website: {
                  type: "string",
                  example: "https://johndoe.dev",
                },
              },
            },
            publishedCourses: {
              type: "array",
              items: { type: "string" },
              example: [],
            },
            createdAt: {
              type: "string",
              format: "date-time",
            },
          },
        },
        ProfileUpdateRequest: {
          type: "object",
          description:
            "Send any combination of base fields + role-specific fields. Unknown fields are ignored.",
          properties: {
            name: { type: "string", example: "Jane Doe" },
            avatar: {
              type: "string",
              example: "https://example.com/avatar.jpg",
            },
            headline: {
              type: "string",
              description: "Teacher only",
              example: "Full-Stack Developer & Educator",
            },
            bio: {
              type: "string",
              description: "Teacher only",
              example: "I love building and teaching web applications.",
            },
            socialLinks: {
              type: "object",
              description: "Teacher only",
              properties: {
                linkedin: { type: "string" },
                twitter: { type: "string" },
                website: { type: "string" },
              },
            },
            wishlist: {
              type: "array",
              description: "Student only — array of course IDs",
              items: { type: "string" },
            },
          },
        },
      },
    },
  },
  apis: ["./src/routes/*.ts"],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

export default swaggerSpec;
