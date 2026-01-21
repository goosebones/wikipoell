"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/styles/components/ui/collapsible";
import { ChevronDownIcon, ChevronRightIcon } from "lucide-react";

function CategoryLink({ category, categoryName, onSelect, isRoot }) {
  const pathname = usePathname();
  const href = isRoot
    ? "/category"
    : `/category/${category._id.split(".").join("/")}`;
  const isActive = pathname === href;

  return (
    <div className="w-full pt-2">
      <Link
        href={href}
        onClick={() => onSelect?.()}
        className={`block w-full text-sm transition-colors hover:bg-accent hover:text-accent-foreground ${
          isActive ? "bg-accent text-accent-foreground" : ""
        }`}
      >
        {categoryName || category.name}
      </Link>
    </div>
  );
}

// Recursive component to render collapsible category items
function CategoryCollapsible({ category, onSelect }) {
  const pathname = usePathname();
  const href = `/category/${category._id.split(".").join("/")}`;
  const isActiveOrDescendant = pathname.startsWith(href);
  const [isOpen, setIsOpen] = useState(isActiveOrDescendant);
  if (category.children.length === 0) {
    return <CategoryLink category={category} onSelect={onSelect} />;
  }

  return (
    <Collapsible defaultOpen={isActiveOrDescendant}>
      <CollapsibleTrigger
        onClick={() => setIsOpen(!isOpen)}
        className={`mt-2 flex items-center justify-between w-full text-sm transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground ${
          isActiveOrDescendant ? "bg-accent text-accent-foreground" : ""
        }`}
      >
        {category.name}
        {isOpen ? (
          <ChevronDownIcon className="size-4" />
        ) : (
          <ChevronRightIcon className="size-4" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        <CategoryLink
          category={category}
          categoryName={`All ${category.name}`}
          onSelect={onSelect}
        />
        {category.children.map((child) => (
          <CategoryCollapsible
            key={child._id}
            category={child}
            onSelect={onSelect}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function CategoriesMenuClient({ categoryTree }) {
  const [rootOpen, setRootOpen] = useState(false);

  return (
    <Collapsible open={rootOpen} onOpenChange={setRootOpen}>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-lg font-semibold transition-colors cursor-pointer hover:bg-accent hover:text-accent-foreground">
        Categories
        {rootOpen ? (
          <ChevronDownIcon className="size-5" />
        ) : (
          <ChevronRightIcon className="size-5" />
        )}
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        <CategoryLink
          category={categoryTree}
          categoryName={`All Categories`}
          onSelect={() => setRootOpen(false)}
          isRoot={true}
        />
        {categoryTree.map((category) => (
          <CategoryCollapsible
            key={category._id}
            category={category}
            onSelect={() => setRootOpen(false)}
          />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
