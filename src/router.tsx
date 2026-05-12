import { StudentHome } from "@/ui/screens/student/Home";
import { StudentProfilePicker } from "@/ui/screens/student/ProfilePicker";
import { StudentSession } from "@/ui/screens/student/Session";
import { StudentUnitStudy } from "@/ui/screens/student/UnitStudy";
import { TutorContent } from "@/ui/screens/tutor/Content";
import { TutorDashboard } from "@/ui/screens/tutor/Dashboard";
import { TutorImports } from "@/ui/screens/tutor/Imports";
import { TutorSettings } from "@/ui/screens/tutor/Settings";
import { TutorStudentDetail } from "@/ui/screens/tutor/StudentDetail";
import { TutorStudents } from "@/ui/screens/tutor/Students";
import { StudentLayout } from "@/ui/shell/StudentLayout";
import { TutorLayout } from "@/ui/shell/TutorLayout";
import {
  Outlet,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";

const rootRoute = createRootRoute({
  component: () => <Outlet />,
});

const tutorRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "tutor",
  component: TutorLayout,
});

const tutorIndexRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "/",
  component: TutorDashboard,
});

const tutorDashboardRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "dashboard",
  component: TutorDashboard,
});

const tutorStudentsRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "students",
  component: TutorStudents,
});

const tutorStudentDetailRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "students/$studentId",
  component: TutorStudentDetail,
});

interface ContentSearch {
  entry?: number;
  book?: number;
}

const tutorContentRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "content",
  component: TutorContent,
  validateSearch: (raw: Record<string, unknown>): ContentSearch => {
    const out: ContentSearch = {};
    const entry = Number(raw.entry);
    if (Number.isFinite(entry) && entry > 0) out.entry = entry;
    const book = Number(raw.book);
    if (Number.isFinite(book) && book > 0) out.book = book;
    return out;
  },
});

const tutorImportsRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "imports",
  component: TutorImports,
});

const tutorSettingsRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "settings",
  component: TutorSettings,
});

const studentRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "student",
  component: StudentLayout,
});

const studentIndexRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: "/",
  component: StudentProfilePicker,
});

const studentProfileRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: "profile/$studentId",
  component: StudentHome,
});

const studentUnitRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: "profile/$studentId/unit/$unitId",
  component: StudentUnitStudy,
});

interface StudentSessionSearch {
  sections?: string;
}

const studentSessionRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: "profile/$studentId/session/$lessonId",
  component: StudentSession,
  validateSearch: (raw: Record<string, unknown>): StudentSessionSearch => {
    return typeof raw.sections === "string" && raw.sections.length > 0
      ? { sections: raw.sections }
      : {};
  },
});

const routeTree = rootRoute.addChildren([
  tutorRoute.addChildren([
    tutorIndexRoute,
    tutorDashboardRoute,
    tutorStudentsRoute,
    tutorStudentDetailRoute,
    tutorContentRoute,
    tutorImportsRoute,
    tutorSettingsRoute,
  ]),
  studentRoute.addChildren([
    studentIndexRoute,
    studentProfileRoute,
    studentUnitRoute,
    studentSessionRoute,
  ]),
]);

export const router = createRouter({
  routeTree,
  history: createMemoryHistory({ initialEntries: ["/tutor/dashboard"] }),
  defaultPreload: "intent",
});

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
