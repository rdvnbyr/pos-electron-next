import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-white px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold text-gray-900">
        404 - Page Not Found
      </h1>
      <p className="mb-8 text-gray-600">
        Oops! The page you are looking for doesnt exist.
      </p>
      <Link
        href="/"
        className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700"
      >
        Go to Home
      </Link>
    </div>
  );
}
