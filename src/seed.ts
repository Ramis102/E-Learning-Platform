// @ts-nocheck
import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import bcrypt from "bcrypt";
import connectDB from "./config/db";
import User, { UserRole } from "./models/User";
import StudentProfile from "./models/StudentProfile";
import TeacherProfile from "./models/TeacherProfile";
import Course from "./models/Course";
import Module from "./models/Module";
import Lecture from "./models/Lecture";
import Quiz from "./models/Quiz";
import Question from "./models/Question";
import Attempt from "./models/Attempt";
import Blog from "./models/Blog";
import Notification from "./models/Notification";
import Certificate from "./models/Certificate";
import CourseComment from "./models/CourseComment";
import LectureProgress from "./models/LectureProgress";
import StudentCourseStatsModel from "./models/StudentCourseStats";

const seed = async () => {
  await connectDB();
  console.log("🗑️  Clearing existing data...");

  await Promise.all([
    User.deleteMany({}), StudentProfile.deleteMany({}), TeacherProfile.deleteMany({}),
    Course.deleteMany({}), Module.deleteMany({}), Lecture.deleteMany({}),
    Quiz.deleteMany({}), Question.deleteMany({}), Attempt.deleteMany({}),
    Blog.deleteMany({}), Notification.deleteMany({}), Certificate.deleteMany({}),
    CourseComment.deleteMany({}), LectureProgress.deleteMany({}),
    StudentCourseStatsModel.deleteMany({}),
  ]);

  const hash = await bcrypt.hash("password123", 12);

  // ── Users ──────────────────────────────────────────────────────────────
  // Use insertMany to bypass pre-save hook (password is already hashed)
  console.log("👤 Creating users...");
  const teachers = await User.insertMany([
    { name: "Dr. Sarah Chen", email: "teacher1@edulearn.com", password: hash, role: UserRole.TEACHER, isActive: true },
    { name: "Prof. James Miller", email: "teacher2@edulearn.com", password: hash, role: UserRole.TEACHER, isActive: true },
    { name: "Dr. Amina Patel", email: "teacher3@edulearn.com", password: hash, role: UserRole.TEACHER, isActive: true },
  ]);
  const [t1, t2, t3] = teachers;

  const students = await User.insertMany([
    { name: "Alice Johnson", email: "student1@edulearn.com", password: hash, role: UserRole.STUDENT, isActive: true },
    { name: "Bob Williams", email: "student2@edulearn.com", password: hash, role: UserRole.STUDENT, isActive: true },
    { name: "Charlie Brown", email: "student3@edulearn.com", password: hash, role: UserRole.STUDENT, isActive: true },
    { name: "Diana Martinez", email: "student4@edulearn.com", password: hash, role: UserRole.STUDENT, isActive: true },
    { name: "Ethan Davis", email: "student5@edulearn.com", password: hash, role: UserRole.STUDENT, isActive: true },
  ]);
  const [s1, s2, s3, s4, s5] = students;

  const [admin] = await User.insertMany([
    { name: "Admin User", email: "admin@edulearn.com", password: hash, role: UserRole.ADMIN, isActive: true },
  ]);

  // ── Profiles ───────────────────────────────────────────────────────────
  console.log("📋 Creating profiles...");
  await TeacherProfile.create([
    { userId: t1._id, headline: "Computer Science Professor", bio: "15 years of teaching experience in CS.", socialLinks: { linkedin: "https://linkedin.com/in/sarahchen" } },
    { userId: t2._id, headline: "Mathematics Professor", bio: "Specializing in calculus and linear algebra.", socialLinks: { linkedin: "https://linkedin.com/in/jamesmiller" } },
    { userId: t3._id, headline: "Data Science Instructor", bio: "Industry expert in ML and data analysis.", socialLinks: { linkedin: "https://linkedin.com/in/aminapatel" } },
  ]);

  const sp1 = await StudentProfile.create({ userId: s1._id, enrolledCourses: [] });
  const sp2 = await StudentProfile.create({ userId: s2._id, enrolledCourses: [] });
  const sp3 = await StudentProfile.create({ userId: s3._id, enrolledCourses: [] });
  const sp4 = await StudentProfile.create({ userId: s4._id, enrolledCourses: [] });
  const sp5 = await StudentProfile.create({ userId: s5._id, enrolledCourses: [] });

  // ── Courses ────────────────────────────────────────────────────────────
  console.log("📚 Creating courses...");
  const courses = await Course.create([
    { title: "Data Structures & Algorithms", description: "Master fundamental CS concepts including arrays, linked lists, trees, and sorting algorithms.", instructor: t1._id, category: "development", difficulty: "intermediate", tags: ["cs", "algorithms", "data-structures"], isPublished: true, totalEnrolments: 0 },
    { title: "Web Development Bootcamp", description: "Full-stack web development with HTML, CSS, JavaScript, React, and Node.js.", instructor: t1._id, category: "development", difficulty: "beginner", tags: ["web", "javascript", "react"], isPublished: true, totalEnrolments: 0 },
    { title: "Calculus I: Limits & Derivatives", description: "Introduction to single-variable calculus covering limits, continuity, and differentiation.", instructor: t2._id, category: "science", difficulty: "beginner", tags: ["math", "calculus"], isPublished: true, totalEnrolments: 0 },
    { title: "Linear Algebra Essentials", description: "Vectors, matrices, eigenvalues, and their applications in data science.", instructor: t2._id, category: "science", difficulty: "intermediate", tags: ["math", "linear-algebra"], isPublished: true, totalEnrolments: 0 },
    { title: "Machine Learning Foundations", description: "Learn supervised and unsupervised learning, neural networks, and model evaluation.", instructor: t3._id, category: "development", difficulty: "advanced", tags: ["ml", "ai", "python"], isPublished: true, totalEnrolments: 0 },
    { title: "Statistics for Data Science", description: "Probability, distributions, hypothesis testing, and regression analysis.", instructor: t3._id, category: "science", difficulty: "intermediate", tags: ["statistics", "data-science"], isPublished: true, totalEnrolments: 0 },
  ]);

  // Helper to create module + lecture + quiz + questions for a course
  const createModuleWithContent = async (
    courseId: mongoose.Types.ObjectId,
    moduleData: { title: string; order: number },
    lectureData: { title: string; content: string },
    questions: Array<{ text: string; options: string[]; correctIndex: number; type?: string }>
  ) => {
    const mod = await Module.create({ title: moduleData.title, course: courseId, order: moduleData.order });
    const lec = await Lecture.create({ title: lectureData.title, content: lectureData.content, course: courseId, module: mod._id, order: 1 });
    const quiz = await Quiz.create({ title: `${moduleData.title} Quiz`, module: mod._id, course: courseId, lecture: lec._id, questions: [], passMark: 60, isActive: true });

    const questionDocs = await Question.create(
      questions.map((q, i) => ({
        quiz: quiz._id, text: q.text, type: q.type || "mcq", options: q.options, correctIndex: q.correctIndex, order: i + 1,
      }))
    );

    quiz.questions = questionDocs.map((q) => q._id) as any;
    await quiz.save();

    return { module: mod, lecture: lec, quiz, questions: questionDocs };
  };

  // ── Modules for Course 1: DSA ──────────────────────────────────────────
  console.log("📦 Creating modules, lectures, quizzes...");
  const c1m1 = await createModuleWithContent(courses[0]._id as mongoose.Types.ObjectId, { title: "Arrays & Strings", order: 1 },
    { title: "Understanding Arrays", content: "<h2>Arrays</h2><p>An array is a contiguous block of memory storing elements of the same type. Access is O(1) by index.</p><h3>Key Operations</h3><ul><li>Access: O(1)</li><li>Search: O(n)</li><li>Insert/Delete: O(n)</li></ul>" },
    [
      { text: "What is the time complexity of accessing an array element by index?", options: ["O(n)", "O(log n)", "O(1)", "O(n²)"], correctIndex: 2 },
      { text: "Arrays store elements in contiguous memory.", options: ["True", "False"], correctIndex: 0, type: "true_false" },
      { text: "Which operation is most expensive in an unsorted array?", options: ["Access", "Search", "Insertion at end", "Reading length"], correctIndex: 1 },
    ]
  );

  const c1m2 = await createModuleWithContent(courses[0]._id as mongoose.Types.ObjectId, { title: "Linked Lists", order: 2 },
    { title: "Linked List Fundamentals", content: "<h2>Linked Lists</h2><p>A linked list consists of nodes where each node contains data and a pointer to the next node.</p>" },
    [
      { text: "What is the time complexity of inserting at the head of a linked list?", options: ["O(n)", "O(log n)", "O(1)", "O(n²)"], correctIndex: 2 },
      { text: "A doubly linked list uses more memory than a singly linked list.", options: ["True", "False"], correctIndex: 0, type: "true_false" },
      { text: "Which data structure uses LIFO ordering?", options: ["Queue", "Stack", "Array", "Tree"], correctIndex: 1 },
    ]
  );

  const c1m3 = await createModuleWithContent(courses[0]._id as mongoose.Types.ObjectId, { title: "Sorting Algorithms", order: 3 },
    { title: "Comparison-Based Sorting", content: "<h2>Sorting</h2><p>Sorting algorithms arrange elements in a specific order. Common algorithms include Merge Sort O(n log n) and Quick Sort O(n log n) average.</p>" },
    [
      { text: "What is the best worst-case time complexity for comparison-based sorting?", options: ["O(n)", "O(n log n)", "O(n²)", "O(log n)"], correctIndex: 1 },
      { text: "Quick Sort is always faster than Merge Sort.", options: ["True", "False"], correctIndex: 1, type: "true_false" },
      { text: "Which sorting algorithm is stable?", options: ["Quick Sort", "Heap Sort", "Merge Sort", "Selection Sort"], correctIndex: 2 },
    ]
  );

  // ── Modules for Course 2: Web Dev ──────────────────────────────────────
  await createModuleWithContent(courses[1]._id as mongoose.Types.ObjectId, { title: "HTML & CSS Basics", order: 1 },
    { title: "Building Web Pages", content: "<h2>HTML & CSS</h2><p>HTML provides structure, CSS provides styling. Together they form the foundation of web development.</p>" },
    [
      { text: "What does HTML stand for?", options: ["Hyper Text Markup Language", "High Tech Modern Language", "Hyper Transfer Markup Language", "Home Tool Markup Language"], correctIndex: 0 },
      { text: "CSS stands for Cascading Style Sheets.", options: ["True", "False"], correctIndex: 0, type: "true_false" },
    ]
  );

  await createModuleWithContent(courses[1]._id as mongoose.Types.ObjectId, { title: "JavaScript Fundamentals", order: 2 },
    { title: "Learning JavaScript", content: "<h2>JavaScript</h2><p>JavaScript is the programming language of the web, enabling dynamic and interactive content.</p>" },
    [
      { text: "Which keyword declares a block-scoped variable in JS?", options: ["var", "let", "both", "none"], correctIndex: 1 },
      { text: "JavaScript is a statically typed language.", options: ["True", "False"], correctIndex: 1, type: "true_false" },
    ]
  );

  await createModuleWithContent(courses[1]._id as mongoose.Types.ObjectId, { title: "React Basics", order: 3 },
    { title: "Introduction to React", content: "<h2>React</h2><p>React is a JavaScript library for building user interfaces using components and a virtual DOM.</p>" },
    [
      { text: "React uses a Virtual DOM for performance.", options: ["True", "False"], correctIndex: 0, type: "true_false" },
      { text: "What hook manages state in functional components?", options: ["useEffect", "useState", "useRef", "useMemo"], correctIndex: 1 },
    ]
  );

  // ── Modules for Course 3-6 (simpler) ───────────────────────────────────
  for (let ci = 2; ci < 6; ci++) {
    for (let mi = 1; mi <= 3; mi++) {
      await createModuleWithContent(courses[ci]._id as mongoose.Types.ObjectId,
        { title: `Module ${mi}`, order: mi },
        { title: `Lecture ${mi}`, content: `<h2>Module ${mi} Content</h2><p>This is the lecture content for module ${mi} of the course "${courses[ci].title}".</p>` },
        [
          { text: `Sample question 1 for module ${mi}`, options: ["Option A", "Option B", "Option C", "Option D"], correctIndex: 0 },
          { text: `Sample question 2 for module ${mi}`, options: ["True", "False"], correctIndex: 0, type: "true_false" },
        ]
      );
    }
  }

  // ── Enrollments ────────────────────────────────────────────────────────
  console.log("🎓 Enrolling students...");
  const enrollments: Array<[any, mongoose.Types.ObjectId[]]> = [
    [sp1, [courses[0]._id, courses[1]._id, courses[4]._id] as mongoose.Types.ObjectId[]],
    [sp2, [courses[0]._id, courses[2]._id] as mongoose.Types.ObjectId[]],
    [sp3, [courses[1]._id, courses[3]._id, courses[5]._id] as mongoose.Types.ObjectId[]],
    [sp4, [courses[0]._id, courses[4]._id] as mongoose.Types.ObjectId[]],
    [sp5, [courses[2]._id, courses[5]._id] as mongoose.Types.ObjectId[]],
  ];

  for (const [profile, courseIds] of enrollments) {
    profile.enrolledCourses = courseIds;
    await profile.save();
    for (const cId of courseIds) {
      await Course.findByIdAndUpdate(cId, { $inc: { totalEnrolments: 1 } });
    }
  }

  // ── Quiz Attempts ──────────────────────────────────────────────────────
  console.log("📝 Creating quiz attempts...");
  // Helper to create attempt
  const createAttempt = async (student: any, quizDoc: any, courseId: any, scoreOverride?: number) => {
    const questions = await Question.find({ quiz: quizDoc._id }).lean();
    const score = scoreOverride ?? Math.floor(Math.random() * 60 + 40);
    const passed = score >= (quizDoc.passMark || 60);
    return Attempt.create({
      student: student._id, quiz: quizDoc._id, course: courseId,
      completedAt: new Date(Date.now() - Math.random() * 7 * 86400000),
      answers: questions.map((q, i) => ({
        questionId: q._id,
        selectedIndex: passed ? q.correctIndex : (i === 0 ? q.correctIndex : 0),
        isCorrect: passed ? true : i === 0,
      })),
      score, passed,
    });
  };

  // S1 passes all DSA quizzes
  const dsaQuizzes = await Quiz.find({ course: courses[0]._id }).lean();
  for (const q of dsaQuizzes) await createAttempt(s1, q, courses[0]._id, 100);

  // S1 attempts Web Dev quizzes
  const webQuizzes = await Quiz.find({ course: courses[1]._id }).lean();
  if (webQuizzes[0]) await createAttempt(s1, webQuizzes[0], courses[1]._id, 85);

  // S2 partial attempt on DSA
  if (dsaQuizzes[0]) await createAttempt(s2, dsaQuizzes[0], courses[0]._id, 33);
  // S2 attempts Calculus quiz
  const calcQuizzes = await Quiz.find({ course: courses[2]._id }).lean();
  if (calcQuizzes[0]) await createAttempt(s2, calcQuizzes[0], courses[2]._id, 72);

  // S3 attempts Web Dev and Linear Algebra
  if (webQuizzes[0]) await createAttempt(s3, webQuizzes[0], courses[1]._id, 90);
  const laQuizzes = await Quiz.find({ course: courses[3]._id }).lean();
  if (laQuizzes[0]) await createAttempt(s3, laQuizzes[0], courses[3]._id, 55);

  // S4 attempts DSA and ML
  if (dsaQuizzes[0]) await createAttempt(s4, dsaQuizzes[0], courses[0]._id, 78);
  const mlQuizzes = await Quiz.find({ course: courses[4]._id }).lean();
  if (mlQuizzes[0]) await createAttempt(s4, mlQuizzes[0], courses[4]._id, 65);

  // S5 attempts Calculus and Stats
  if (calcQuizzes[0]) await createAttempt(s5, calcQuizzes[0], courses[2]._id, 88);
  const statsQuizzes = await Quiz.find({ course: courses[5]._id }).lean();
  if (statsQuizzes[0]) await createAttempt(s5, statsQuizzes[0], courses[5]._id, 70);

  // ── Certificate for student1 on DSA (enrolled + all quizzes passed) ────
  console.log("🏆 Creating certificates...");
  await Certificate.create({ student: s1._id, course: courses[0]._id, score: 100, completedAt: new Date() });

  // ── Blogs ──────────────────────────────────────────────────────────────
  console.log("📰 Creating blog posts...");
  await Blog.create([
    {
      title: "Getting Started with Data Structures",
      author: t1._id,
      content: "<h2>Why Data Structures Matter</h2><p>Data structures are the foundation of efficient programming. They determine how data is organized, stored, and manipulated in computer memory.</p><h3>Key Concepts</h3><ul><li><strong>Arrays</strong> — contiguous memory blocks for fast indexed access</li><li><strong>Linked Lists</strong> — dynamic structures for efficient insertion/deletion</li><li><strong>Trees</strong> — hierarchical structures for search and sorting</li><li><strong>Graphs</strong> — networks of connected nodes</li></ul><p>Understanding these structures will make you a significantly better programmer, regardless of the language you use.</p><blockquote>The difference between a good programmer and a great one is their understanding of data structures. — Anonymous</blockquote>",
      tags: ["cs", "beginner", "algorithms"],
      isPublished: true,
      comments: [
        { author: s1._id, content: "Great article! Very helpful for beginners.", createdAt: new Date() },
        { author: s2._id, content: "Could you cover hash maps next?", createdAt: new Date() },
        { author: s4._id, content: "The tree section was especially clear.", createdAt: new Date() },
      ],
    },
    {
      title: "Why Learn Calculus?",
      author: t2._id,
      content: "<h2>Calculus in the Real World</h2><p>Calculus is essential for understanding change and motion in the physical world. From physics to economics, calculus provides the mathematical framework for analyzing dynamic systems.</p><h3>Applications</h3><ol><li><strong>Physics</strong> — velocity, acceleration, and forces</li><li><strong>Engineering</strong> — optimization and signal processing</li><li><strong>Economics</strong> — marginal analysis and growth models</li><li><strong>Machine Learning</strong> — gradient descent and backpropagation</li></ol><p>Even if you never derive an integral by hand again, understanding calculus fundamentally changes how you think about problems.</p>",
      tags: ["math", "education", "science"],
      isPublished: true,
      comments: [{ author: s3._id, content: "Inspired me to take the course!", createdAt: new Date() }],
    },
    {
      title: "The Future of Machine Learning",
      author: t3._id,
      content: "<h2>AI is Transforming Every Industry</h2><p>Machine learning continues to transform industries across the globe. From healthcare diagnostics to autonomous vehicles, ML models are becoming increasingly sophisticated.</p><h3>Emerging Trends</h3><ul><li><strong>Large Language Models</strong> — GPT, Claude, and beyond</li><li><strong>Computer Vision</strong> — real-time object detection and recognition</li><li><strong>Reinforcement Learning</strong> — training agents through interaction</li><li><strong>Edge ML</strong> — running models on mobile and IoT devices</li></ul><h3>Getting Started</h3><p>The best way to learn ML is through hands-on projects. Start with simple linear regression, then progress to neural networks. Libraries like TensorFlow and PyTorch make it easier than ever.</p>",
      tags: ["ml", "ai", "future", "technology"],
      isPublished: true,
      comments: [
        { author: s1._id, content: "Fascinating read! The LLM section was particularly interesting.", createdAt: new Date() },
        { author: s5._id, content: "Would love a follow-up on reinforcement learning.", createdAt: new Date() },
      ],
    },
  ]);

  // ── Notifications ──────────────────────────────────────────────────────
  console.log("🔔 Creating notifications...");
  await Notification.create([
    { recipient: s1._id, type: "certificate_ready", message: "You earned a certificate for Data Structures & Algorithms.", link: "/certificates", isRead: false },
    { recipient: t1._id, type: "new_enrolment", message: "Alice Johnson enrolled in your course.", link: `/courses/${courses[0]._id}`, isRead: false },
    { recipient: s2._id, type: "grade_released", message: "Your DSA quiz has been graded. Score: 33%.", link: "/dashboard", isRead: true },
  ]);

  // ── Course Comments & Ratings ──────────────────────────────────────────
  console.log("💬 Creating course comments...");
  await CourseComment.create([
    { student: s1._id, course: courses[0]._id, content: "Excellent course! The DSA explanations were very clear and the quizzes really helped reinforce the concepts.", rating: 5 },
    { student: s2._id, course: courses[0]._id, content: "Good content but the pace was a bit fast for beginners. Would recommend some prerequisite knowledge.", rating: 4 },
    { student: s3._id, course: courses[0]._id, content: "Great course overall. The practical examples were very helpful.", rating: 4 },
    { student: s1._id, course: courses[1]._id, content: "Amazing web development course! Learned so much about modern frameworks.", rating: 5 },
    { student: s2._id, course: courses[2]._id, content: "The calculus content is well structured and easy to follow.", rating: 5 },
  ]);

  // ── Lecture Progress (richer data) ─────────────────────────────────────
  console.log("📈 Creating lecture progress...");
  // S1: all DSA lectures + 1 web dev lecture
  const dsaLectures = await Lecture.find({ course: courses[0]._id }).lean();
  for (const lec of dsaLectures) {
    await LectureProgress.create({ student: s1._id, lecture: lec._id, module: lec.module, course: courses[0]._id, completedAt: new Date(Date.now() - Math.random() * 5 * 86400000) });
  }
  const webLectures = await Lecture.find({ course: courses[1]._id }).lean();
  if (webLectures[0]) {
    await LectureProgress.create({ student: s1._id, lecture: webLectures[0]._id, module: webLectures[0].module, course: courses[1]._id, completedAt: new Date() });
  }
  // S2: 1 DSA lecture
  if (dsaLectures[0]) {
    await LectureProgress.create({ student: s2._id, lecture: dsaLectures[0]._id, module: dsaLectures[0].module, course: courses[0]._id, completedAt: new Date() });
  }
  // S3: 2 web dev lectures
  for (const lec of webLectures.slice(0, 2)) {
    await LectureProgress.create({ student: s3._id, lecture: lec._id, module: lec.module, course: courses[1]._id, completedAt: new Date() });
  }

  // ── Pre-computed StudentCourseStats ────────────────────────────────────
  console.log("📊 Computing StudentCourseStats...");
  const StudentCourseStats = (await import("./models/StudentCourseStats")).default;
  // For each enrollment, compute and store stats
  for (const [profile, courseIds] of enrollments) {
    const studentId = profile.userId;
    for (const courseId of courseIds) {
      const lectures = await Lecture.find({ course: courseId }).lean();
      const lecturesCompleted = await LectureProgress.countDocuments({ student: studentId, course: courseId });
      const quizzesAll = await Quiz.find({ course: courseId, isActive: true }).lean();
      const attempts = await Attempt.find({ student: studentId, course: courseId }).lean();
      const passedQuizIds = new Set(attempts.filter(a => a.passed).map(a => String(a.quiz)));
      const scores = attempts.map(a => a.score);
      const avgScore = scores.length > 0 ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0;
      const bestScore = scores.length > 0 ? Math.max(...scores) : 0;

      await StudentCourseStats.create({
        student: studentId,
        course: courseId,
        lecturesCompleted,
        totalLectures: lectures.length,
        quizzesAttempted: new Set(attempts.map(a => String(a.quiz))).size,
        quizzesPassed: passedQuizIds.size,
        totalQuizzes: quizzesAll.length,
        bestScore,
        averageScore: avgScore,
        totalAttempts: attempts.length,
        lastActivityAt: new Date(),
      });
    }
  }

  console.log("\n✅ Database seeded successfully!");
  console.log("────────────────────────────────────────");
  console.log("Teacher logins:  teacher1@edulearn.com / password123");
  console.log("Student logins:  student1@edulearn.com / password123");
  console.log("Admin login:     admin@edulearn.com    / password123");
  console.log("────────────────────────────────────────\n");

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => { console.error("Seed Error:", err); process.exit(1); });

