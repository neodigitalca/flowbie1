import React from "react";
import { BlogGeneratorShell, type BlogGeneratorShellProps } from "./BlogGeneratorShell";

export type BlogGeneratorTabContentProps = BlogGeneratorShellProps;

export const BlogGeneratorTabContent: React.FC<BlogGeneratorTabContentProps> = (props) => {
  return <BlogGeneratorShell {...props} />;
};
