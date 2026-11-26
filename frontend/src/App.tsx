import { DemoProvider } from './app/DemoProvider';
import { ThemeProvider } from './app/ThemeProvider';
import { AppRoutes } from './app/routes';

export default function App() {
  return (
    <ThemeProvider>
      <DemoProvider>
        <AppRoutes />
      </DemoProvider>
    </ThemeProvider>
  );
}
