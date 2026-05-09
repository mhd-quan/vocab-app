import { StudentHome } from "@/ui/screens/student/Home";
import { StudentProfilePicker } from "@/ui/screens/student/ProfilePicker";
import { StudentSession } from "@/ui/screens/student/Session";
import { TutorContent } from "@/ui/screens/tutor/Content";
import { TutorDashboard } from "@/ui/screens/tutor/Dashboard";
import { TutorImports } from "@/ui/screens/tutor/Imports";
import { TutorSettings } from "@/ui/screens/tutor/Settings";
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

const tutorContentRoute = createRoute({
  getParentRoute: () => tutorRoute,
  path: "content",
  component: TutorContent,
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

const studentSessionRoute = createRoute({
  getParentRoute: () => studentRoute,
  path: "profile/$studentId/session/$lessonId",
  component: StudentSession,
});

const routeTree = rootRoute.addChildren([
  tutorRoute.addChildren([
    tutorIndexRoute,
    tutorDashboardRoute,
    tutorStudentsRoute,
    tutorContentRoute,
    tutorImportsRoute,
    tutorSettingsRoute,
  ]),
  studentRoute.addChildren([studentIndexRoute, studentProfileRoute, studentSessionRoute]),
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
