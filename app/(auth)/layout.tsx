export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center p-6"
      style={{ background: 'radial-gradient(ellipse at 50% 0%, #1a2744 0%, #0B1120 60%)' }}
    >
      {children}
      <p className="mt-8 text-xs text-[#334155]">
        © {new Date().getFullYear()} sqilled Options · For educational purposes only
      </p>
    </div>
  );
}
