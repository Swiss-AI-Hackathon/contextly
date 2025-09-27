import { Link } from "react-router-dom";
export default function Notes(){
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="container mx-auto py-12">
        <h1 className="text-2xl font-bold">Notes Page</h1>
        <p className="mt-4 text-muted-foreground">Notes placeholder page.</p>
        <div className="mt-6"><Link to="/" className="text-sm text-primary underline">Return to AI Assistant</Link></div>
      </div>
    </div>
  )
}
