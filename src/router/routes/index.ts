import { HOME_ROUTE, PAGE_NOT_FOUND_ROUTE, LOGIN_ROUTE } from '@/router/routes/basic'
import CHAT_ROUTE from '@/router/routes/modules/chat.ts'
import PROXY_ROUTE from '@/router/routes/modules/proxy.ts'
import MONITOR_ROUTE from '@/router/routes/modules/monitor.ts'
import TOOL_ROUTE from '@/router/routes/modules/tool.ts'
import SYSTEM_ROUTE from '@/router/routes/modules/system.ts'
// import ABOUT_ROUTE from '@/router/routes/modules/about'
import TEST_ROUTE from '@/router/routes/modules/test'
// import NESTED_ROUTE from "@/router/routes/modules/nested";

export const basicRoutes = [
  LOGIN_ROUTE,
  HOME_ROUTE,
  CHAT_ROUTE,
  PROXY_ROUTE,
  MONITOR_ROUTE,
  TOOL_ROUTE,
  SYSTEM_ROUTE,
  // ABOUT_ROUTE,
  TEST_ROUTE,
  // NESTED_ROUTE,
  PAGE_NOT_FOUND_ROUTE,
]
