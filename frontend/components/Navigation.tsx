"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const Navigation = () => {
  const pathname = usePathname();

  const isActive = (path: string) => pathname === path;

  const navItems = [
    { label: "Home 🏠", href: "/" },
    { label: "Quiz 📝", href: "/quiz" },
    { label: "Review 📖", href: "/review" },
    { label: "Listening 🎧", href: "/listening" },
    { label: "Manage 🛠️", href: "/manage" },
    { label: "Settings ⚙️", href: "/settings" },
  ];

  return (
    <nav className="w-64 bg-white border-r border-gray-200 p-6 flex flex-col overflow-y-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">FillIn</h1>
        <p className="text-sm text-gray-500">Learning platform</p>
      </div>

      <ul className="space-y-2 flex-1">
        {navItems.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className={`block px-4 py-2 rounded-lg transition-colors ${
                isActive(item.href)
                  ? "bg-blue-500 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          </li>
        ))}
      </ul>

      <div className="border-t pt-4 text-sm text-gray-500">
        <p>Made for effective learning.</p>
      </div>
    </nav>
  );
};

export default Navigation;
