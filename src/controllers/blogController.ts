import { Request, Response } from "express";
import mongoose, { Types } from "mongoose";
import Blog, { IBlogDocument } from "../models/Blog";
import { AuthRequest } from "../middleware/authMiddleware";

const isValidObjectId = (id: string): boolean => mongoose.isValidObjectId(id);

export const createBlog = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const { title, content, tags, thumbnail, isPublished } = req.body;

    if (!title || !content) {
      res.status(400).json({
        success: false,
        message: "Please provide title and content",
      });
      return;
    }

    const blog = await Blog.create({
      author: user._id,
      title,
      content,
      tags: tags || [],
      thumbnail: thumbnail || "",
      isPublished: isPublished || false,
      publishedAt: isPublished ? new Date() : null,
      comments: [],
    });

    const freshBlog = await Blog.findById(blog._id)
      .populate("author", "name email avatar")
      .populate("comments.author", "name email avatar");

    res.status(201).json({
      success: true,
      message: "Blog created successfully",
      data: freshBlog,
    });
  } catch (error) {
    console.error("CreateBlog Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while creating blog",
    });
  }
};

export const getBlogs = async (req: Request, res: Response): Promise<void> => {
  try {
    const { search, tags, author } = req.query as Record<
      string,
      string | undefined
    >;

    const query: Record<string, unknown> = { isPublished: true };

    if (search) {
      query.$text = { $search: search };
    }

    if (tags && typeof tags === "string") {
      query.tags = { $in: tags.split(",") };
    }

    if (author && isValidObjectId(author)) {
      query.author = author;
    }

    const blogs = await Blog.find(query)
      .populate("author", "name email avatar")
      .populate("comments.author", "name email avatar")
      .sort({ publishedAt: -1 });

    res.status(200).json({
      success: true,
      count: blogs.length,
      data: blogs,
    });
  } catch (error) {
    console.error("GetBlogs Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while fetching blogs",
    });
  }
};

export const getBlogById = async (req: Request, res: Response): Promise<void> => {
  try {
    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({ success: false, message: "Invalid blog ID" });
      return;
    }

    const blog = await Blog.findById(id)
      .populate("author", "name email avatar role")
      .populate("comments.author", "name email avatar");

    if (!blog) {
      res.status(404).json({ success: false, message: "Blog not found" });
      return;
    }

    res.status(200).json({ success: true, data: blog });
  } catch (error) {
    console.error("GetBlogById Error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

export const addComment = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = (req as AuthRequest).user;

    if (!user) {
      res.status(401).json({
        success: false,
        message: "Not authorized",
      });
      return;
    }

    const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const { content } = req.body;

    if (!id || !isValidObjectId(id)) {
      res.status(400).json({
        success: false,
        message: "Invalid blog ID",
      });
      return;
    }

    if (!content || content.trim() === "") {
      res.status(400).json({
        success: false,
        message: "Comment content is required",
      });
      return;
    }

    const blog = await Blog.findById(id);

    if (!blog) {
      res.status(404).json({
        success: false,
        message: "Blog not found",
      });
      return;
    }

    if (!blog.isPublished) {
      res.status(403).json({
        success: false,
        message: "Cannot comment on unpublished blog",
      });
      return;
    }

    const comment = {
      _id: new Types.ObjectId(),
      author: user._id as Types.ObjectId,
      content: content.trim(),
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    blog.comments.push(comment);
    await blog.save();

    const updatedBlog = await Blog.findById(id)
      .populate("author", "name email avatar")
      .populate("comments.author", "name email avatar");

    res.status(201).json({
      success: true,
      message: "Comment added successfully",
      data: updatedBlog,
    });
  } catch (error) {
    console.error("AddComment Error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error while adding comment",
    });
  }
};