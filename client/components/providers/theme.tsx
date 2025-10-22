import { createTheme, ThemeProvider } from "flowbite-react";

const customeTheme = createTheme({
  button: {
    color: {
      primary: "bg-blue-600 hover:bg-blue-700 text-white",
      secondary: "bg-gray-600 hover:bg-gray-700 text-white",
      success: "bg-green-600 hover:bg-green-700 text-white",
      danger: "bg-red-600 hover:bg-red-700 text-white",
      warning: "bg-yellow-500 hover:bg-yellow-600 text-white",
      info: "bg-teal-600 hover:bg-teal-700 text-white",
      light: "bg-gray-100 hover:bg-gray-200 text-black",
      dark: "bg-gray-800 hover:bg-gray-900 text-white",
    },
    size: {
      sm: "px-3 py-1.5 text-sm",
      md: "px-4 py-2 text-base",
      lg: "px-5 py-3 text-lg",
    },
    // Add any additional button styles here
  },
});

function ThemeProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ThemeProvider theme={customeTheme}>{children}</ThemeProvider>;
}

export default ThemeProviderWrapper;
