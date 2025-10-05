import { NavLink } from "react-router-dom";

export default function Placeholder({ title }: { title: string }) {
  return (
    <div className="min-h-[50vh] grid place-items-center text-center">
      <div>
        <h1 className="text-2xl font-bold mb-2">{title}</h1>
        <p className="text-muted-foreground max-w-md">This page is ready to be filled. Tell me what you want here and I'll build it next. Navigation and layout are already shared across the app.</p>
        <div className="mt-4 text-sm"><NavLink to="/" className="underline">Back to Dashboard</NavLink></div>
      </div>
    </div>
  );
}
