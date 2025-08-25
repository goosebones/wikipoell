import { getCategories } from "@/lib/categories";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/styles/components/ui/collapsible";
import { ChevronDownIcon } from "lucide-react";
import Link from "next/link";

function buildCategoryTree(categories) {
  const categoryMap = {};
  const rootNodes = [];

  categories.forEach((category) => {
    categoryMap[category._id] = { ...category, children: [] };
  });

  categories.forEach((category) => {
    const node = categoryMap[category._id];
    if (category.parent === null) {
      rootNodes.push(node);
    } else {
      const parentNode = categoryMap[category.parent];
      if (parentNode) {
        parentNode.children.push(node);
      }
    }
  });

  return rootNodes;
}

function CategoryLink({ category, categoryName }) {
  return (
    <div className="w-full pt-2">
      <Link
        href={`/category/${category._id.split(".").join("/")}`}
        className="block w-full text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
      >
        {categoryName || category.name}
      </Link>
    </div>
  );
}

// Recursive component to render collapsible category items
function CategoryCollapsible({ category }) {
  if (category.children.length === 0) {
    return <CategoryLink category={category} />;
  }

  return (
    <Collapsible>
      <CollapsibleTrigger className="mt-2 flex items-center justify-between w-full text-sm hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
        {category.name}
        <ChevronDownIcon className="size-4" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        <CategoryLink
          category={category}
          categoryName={`All ${category.name}`}
        />

        {category.children.map((child) => (
          <CategoryCollapsible key={child._id} category={child} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}

export default async function CategoriesMenu() {
  const categories = await getCategories();
  const categoryTree = buildCategoryTree(categories);

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center justify-between w-full text-lg font-semibold hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
        Categories
        <ChevronDownIcon className="size-5" />
      </CollapsibleTrigger>
      <CollapsibleContent className="pl-4">
        {categoryTree.map((category) => (
          <CategoryCollapsible key={category._id} category={category} />
        ))}
      </CollapsibleContent>
    </Collapsible>
  );
}
