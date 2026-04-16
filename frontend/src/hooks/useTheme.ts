import { useState, useEffect } from "react";

export const useTheme = () => {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, [isDark]);

  const toggleTheme = () => setIsDark((p) => !p);

  return { isDark, toggleTheme };
};
