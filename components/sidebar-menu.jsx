"use client";

import { MenuIcon } from "lucide-react";
import { useState, createContext, useContext } from "react";
import { Box, Flex, Button } from "@mantine/core";

const SidebarContext = createContext(null);

export function useSidebar() {
  return useContext(SidebarContext);
}

export default function SidebarMenu({ children }) {
  const [isOpen, setIsOpen] = useState(false);

  const handleCategorySelect = () => {
    setIsOpen(false);
  };

  return (
    <SidebarContext.Provider value={{ closeSidebar: handleCategorySelect }}>
      <MenuIcon onClick={() => setIsOpen(!isOpen)} />
      {isOpen && (
        <div className="fixed inset-0 bg-white z-9999 overflow-y-auto">
          <Flex
            justify="end"
            align="center"
            className="p-2"
          >
            <Button
              variant="subtle"
              onClick={() => setIsOpen(false)}
            >
              Close
            </Button>
          </Flex>
          <Box p="md">{children}</Box>
        </div>
      )}
    </SidebarContext.Provider>
  );
}
