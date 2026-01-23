"use client";

import { MenuIcon } from "lucide-react";
import { useState, createContext, useContext } from "react";
import { Flex, Section } from "@radix-ui/themes";
import { Button } from "@/styles/components/ui/button";

const SidebarContext = createContext(null);

export function useSidebar() {
  return useContext(SidebarContext);
}

export default function SidebarMenu({children}) {
    const [isOpen, setIsOpen] = useState(false);
    
    const handleCategorySelect = () => {
        setIsOpen(false);
    };
    
    return (
        <SidebarContext.Provider value={{ closeSidebar: handleCategorySelect }}>
            <div>
                <MenuIcon onClick={() => setIsOpen(!isOpen)} />
                {isOpen && (
                    <div className="absolute top-0 left-0 w-full h-full bg-white z-50">
                        <Flex justify="end" align="center">
                            <Button variant="outline" onClick={() => setIsOpen(false)}>Close</Button>
                        </Flex>
                        <Section>
                            {children}
                        </Section>
                    </div>
                )}
            </div>
        </SidebarContext.Provider>
    )
}