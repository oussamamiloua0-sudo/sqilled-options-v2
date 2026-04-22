// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const clerkAppearance: any = {
  variables: {
    colorBackground: '#1E293B',
    colorPrimary: '#F56C49',
    colorText: '#F1F5F9',
    colorTextSecondary: '#64748B',
    colorInputBackground: '#0F172A',
    colorInputText: '#F1F5F9',
    colorDanger: '#EF4444',
    colorNeutral: '#94A3B8',
    borderRadius: '8px',
    fontFamily: 'Inter, system-ui, sans-serif',
    fontSize: '14px',
    spacingUnit: '16px',
  },
  elements: {
    rootBox: { width: '100%' },
    card: {
      background: '#1E293B',
      border: '1px solid #2D3F55',
      borderRadius: '16px',
      boxShadow: '0 24px 48px rgba(0,0,0,0.5)',
      padding: '36px 32px',
    },
    header: { marginBottom: '8px', textAlign: 'center' },
    headerTitle: {
      color: '#F1F5F9',
      fontSize: '20px',
      fontWeight: '600',
    },
    headerSubtitle: {
      color: '#64748B',
      fontSize: '13px',
      marginTop: '4px',
    },
    // Social buttons
    socialButtonsBlockButton: {
      background: '#0F172A',
      border: '1px solid #2D3F55',
      borderRadius: '8px',
      color: '#CBD5E1',
      height: '42px',
      fontSize: '13px',
      fontWeight: '500',
      transition: 'border-color 0.2s',
    },
    socialButtonsBlockButtonText: { color: '#CBD5E1', fontWeight: '500' },
    socialButtonsBlockButtonArrow: { color: '#64748B' },
    // Divider
    dividerLine: { background: '#2D3F55' },
    dividerText: { color: '#475569', fontSize: '12px' },
    // Form fields
    formFieldLabel: {
      color: '#94A3B8',
      fontSize: '12px',
      fontWeight: '500',
      letterSpacing: '0.02em',
    },
    formFieldInput: {
      background: '#0F172A',
      border: '1px solid #2D3F55',
      borderRadius: '8px',
      color: '#F1F5F9',
      height: '42px',
      fontSize: '14px',
    },
    formFieldInputShowPasswordButton: { color: '#64748B' },
    formFieldHintText: { color: '#475569', fontSize: '12px' },
    formFieldErrorText: { color: '#EF4444', fontSize: '12px' },
    // Primary button
    formButtonPrimary: {
      background: '#F56C49',
      borderRadius: '8px',
      color: '#ffffff',
      height: '42px',
      fontSize: '14px',
      fontWeight: '600',
      letterSpacing: '0.01em',
    },
    // Footer
    footerActionLink: { color: '#F56C49', fontWeight: '500' },
    footerActionText: { color: '#64748B' },
    footer: { color: '#475569', fontSize: '12px' },
    footerPages: { color: '#475569' },
    // Identity preview (after email step)
    identityPreviewText: { color: '#F1F5F9' },
    identityPreviewEditButton: { color: '#F56C49' },
    // OTP / verification
    otpCodeFieldInput: {
      background: '#0F172A',
      border: '1px solid #2D3F55',
      borderRadius: '8px',
      color: '#F1F5F9',
      fontSize: '18px',
    },
    // Alternative methods
    alternativeMethodsBlockButton: {
      background: '#0F172A',
      border: '1px solid #2D3F55',
      borderRadius: '8px',
      color: '#CBD5E1',
    },
    alternativeMethodsBlockButtonText: { color: '#CBD5E1' },
  },
};
