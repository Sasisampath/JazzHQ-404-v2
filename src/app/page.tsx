import { NotFoundExperience } from "@/components/NotFoundExperience";

// The prototype previews the 404 at the root; any unknown route also renders it via not-found.tsx.
export default function Page() {
  return <NotFoundExperience />;
}
