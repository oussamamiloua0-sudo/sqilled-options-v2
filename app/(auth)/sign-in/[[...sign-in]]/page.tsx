import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';
import { clerkAppearance } from '@/lib/clerk-appearance';

export default function SignInPage() {
  return (
    <div className="w-full max-w-[400px] flex flex-col items-center">
      {/* Logo */}
      <div className="flex items-center gap-3 mb-8">
        <Image src="/logo.png" alt="sqilled" width={36} height={36} />
        <span className="text-[17px] font-semibold tracking-tight text-white">
          sqilled <span style={{ color: '#F56C49' }}>Options</span>
        </span>
      </div>

      <SignIn appearance={clerkAppearance} />
    </div>
  );
}
