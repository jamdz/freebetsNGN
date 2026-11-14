'use client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useAuth } from '@/components/auth-provider'
import { createClient } from '@/lib/supabase/client'
import { BrandMark, useSiteBrand } from '@/components/site-brand'
import { PageAdSlots } from '@/components/ads/PageAdSlots'
const phone = z.string().regex(/^\+234\d{10}$/, 'Use a valid Nigerian number in +234 format')
const email = z.string().email('Use a valid email address')
const signupSchema = z.object({ email, nickname: z.string().min(3,'Nickname must be at least 3 characters').max(16,'Nickname must be 16 characters or less').regex(/^[a-zA-Z0-9_]+$/,'Use letters, numbers, or underscores only'), phone, password: z.string().min(8,'Password must be at least 8 characters'), referralCode: z.string().optional(), adult: z.literal(true,{error:'You must be 18 or older'}), terms: z.literal(true,{error:'Please accept the Terms and Prize Rules'}) })
const loginSchema = z.object({ identifier: z.string().min(1,'Enter your phone or nickname'), password: z.string().min(1,'Enter your password') })
const forgotPasswordSchema = z.object({ email })
const resetPasswordSchema = z.object({ password: z.string().min(10, 'Password must be at least 10 characters'), confirmPassword: z.string().min(1, 'Please confirm your password') }).refine(({ password, confirmPassword }) => password === confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' })
function Field({ label, error, ...props }: any) { return <label className="flex flex-col gap-2 text-sm font-semibold"><span>{label}</span><input {...props} className="rounded-xl border border-border bg-background px-3.5 py-3 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20" />{error&&<span className="text-xs font-medium text-destructive">{error}</span>}</label> }
function AuthFrame({ title, subtitle, page, children }: { title:string; subtitle:string; page?: 'Login' | 'Signup'; children:React.ReactNode }) { return <main className="flex min-h-screen items-center justify-center bg-muted/30 px-5 py-10"><div className="w-full max-w-md"><Link href="/" className="mx-auto mb-8 flex w-fit items-center gap-2"><BrandMark size="md" showName/></Link><section className="rounded-3xl border border-border bg-card p-6 shadow-xl shadow-black/5 md:p-8"><h1 className="font-display text-3xl font-black">{title}</h1><p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>{children}</section>{page && <PageAdSlots page={page} position="bottom"/>}</div></main> }
export function SignupForm(){ const {signUp}=useAuth(); const {register,handleSubmit,setValue,formState:{errors,isSubmitting}}=useForm<any>({resolver:zodResolver(signupSchema)}); useEffect(() => { const params = new URLSearchParams(window.location.search); const referralCode = (params.get('ref') || sessionStorage.getItem('referralCode') || '').trim().toUpperCase(); const campaignCode = (params.get('campaign') || sessionStorage.getItem('campaignCode') || '').trim().toUpperCase(); if (referralCode) { setValue('referralCode', referralCode); sessionStorage.setItem('referralCode', referralCode) } if (campaignCode) sessionStorage.setItem('campaignCode', campaignCode) }, [setValue]); return <AuthFrame page="Signup" title="Create your account" subtitle="Join the free prediction league and start climbing."><form onSubmit={handleSubmit(signUp)} className="mt-7 flex flex-col gap-4"><Field label="Email" type="email" placeholder="you@example.com" {...register('email')} error={errors.email?.message?.toString()}/><Field label="Nickname" placeholder="e.g. LagosLegend" {...register('nickname')} error={errors.nickname?.message?.toString()}/><Field label="Nigerian phone number" placeholder="+2348012345678" inputMode="tel" {...register('phone')} error={errors.phone?.message?.toString()}/><Field label="Password" type="password" placeholder="At least 8 characters" {...register('password')} error={errors.password?.message?.toString()}/><Field label="Referral code (optional)" placeholder="Enter code" {...register('referralCode')} /><label className="flex items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" className="mt-1 accent-primary" {...register('adult')}/><span>I am 18 or older</span></label>{errors.adult&&<span className="-mt-3 text-xs text-destructive">{errors.adult.message?.toString()}</span>}<label className="flex items-start gap-3 text-sm text-muted-foreground"><input type="checkbox" className="mt-1 accent-primary" {...register('terms')}/><span>I accept the <Link target="_blank" href="/terms" className="text-primary underline">Terms</Link> and <Link target="_blank" href="/prize-rules" className="text-primary underline">Prize Rules</Link></span></label>{errors.terms&&<span className="-mt-3 text-xs text-destructive">{errors.terms.message?.toString()}</span>}<button disabled={isSubmitting} className="mt-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">Create account</button><p className="text-center text-sm text-muted-foreground">Already have an account? <Link href="/login" className="font-bold text-primary">Log in</Link></p></form></AuthFrame> }
export function LoginForm(){ const {siteName}=useSiteBrand(); const {signIn}=useAuth(); const [error,setError]=useState(''); const {register,handleSubmit,formState:{errors,isSubmitting}}=useForm<any>({resolver:zodResolver(loginSchema)}); return <AuthFrame page="Login" title="Welcome back" subtitle="Log in to make your predictions before kickoff."><form onSubmit={handleSubmit(async (data)=>{setError((await signIn({nickname:data.identifier,password:data.password})) ? '' : 'Invalid email, phone, nickname or password')})} className="mt-7 flex flex-col gap-4"><Field label="Email, phone or nickname" placeholder="you@example.com, +234... or nickname" {...register('identifier')} error={errors.identifier?.message?.toString()}/><Field label="Password" type="password" placeholder="Your password" {...register('password')} error={errors.password?.message?.toString()}/><Link href="/forgot-password" className="-mt-1 text-right text-xs font-bold text-primary">Forgot password?</Link>{error&&<p className="text-sm text-destructive">{error}</p>}<button disabled={isSubmitting} className="mt-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">Log in</button><p className="text-center text-sm text-muted-foreground">New to {siteName}? <Link href="/signup" className="font-bold text-primary">Create an account</Link></p></form></AuthFrame> }
export function VerifyForm(){ const {siteName}=useSiteBrand(); const {verifyOtp,user}=useAuth(); const [step,setStep]=useState<'email'|'phone'>('email'); const [email,setEmail]=useState(''); const [code,setCode]=useState(''); const [error,setError]=useState(''); const [message,setMessage]=useState(''); const [seconds,setSeconds]=useState(0); const [busy,setBusy]=useState(false); useEffect(()=>{ const params=new URLSearchParams(window.location.search); setEmail(params.get('email')??user?.email??''); if(params.get('step')==='phone')setStep('phone') },[user?.email]); useEffect(()=>{ if(seconds===0)return; const timer=setTimeout(()=>setSeconds(value=>Math.max(0,value-1)),1000); return ()=>clearTimeout(timer)},[seconds]); const resendEmail=async()=>{setError('');setMessage('');if(!email){setError('The signup email is missing. Return to signup and try again.');return} setBusy(true);const {error:resendError}=await createClient().auth.resend({type:'signup',email});setBusy(false);if(resendError)setError('Unable to resend confirmation email. Please wait a moment and try again.');else setMessage('Confirmation email sent. Check your inbox and spam folder.');}; const sendCode=async()=>{setError('');setMessage('');setBusy(true);const response=await fetch('/api/verification/phone',{method:'POST'});const result=await response.json().catch(()=>({}));setBusy(false);if(!response.ok){setError(result.error??'Unable to send verification code.');if(result.retryAfterSeconds)setSeconds(result.retryAfterSeconds);return}setSeconds(result.cooldownSeconds??30);setMessage(result.mock&&result.developmentCode?`Mock verification code: ${result.developmentCode}`:`Code sent. It expires in ${result.expiresInMinutes} minutes.`)}; const submit=async(e:React.FormEvent)=>{e.preventDefault();setError('');setBusy(true);const valid=await verifyOtp(code);setBusy(false);if(!valid)setError('That code is invalid, expired, or has reached its attempt limit. Request a new code and try again.')}; if(step==='email') return <AuthFrame title="Confirm your email" subtitle="Supabase will email you a confirmation link. Open it to continue with phone verification."><div className="mt-7 flex flex-col gap-4"><p className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-sm text-primary">Confirmation is handled securely by Supabase Auth. After you confirm, you will return here to verify your phone.</p><button type="button" disabled={busy} onClick={resendEmail} className="rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground disabled:opacity-60">{busy?'Sending…':'Resend confirmation email'}</button>{message&&<p role="status" className="text-sm text-primary">{message}</p>}{error&&<p role="alert" className="text-sm text-destructive">{error}</p>}<Link href="/login" className="text-center text-sm font-bold text-primary">Back to login</Link></div></AuthFrame>; return <AuthFrame title="Verify your number" subtitle="Enter the 6-digit verification code sent to your account phone number."><div className="mt-7 flex flex-col gap-4"><button type="button" disabled={busy||seconds>0} onClick={sendCode} className="rounded-xl border border-border py-3.5 font-bold disabled:opacity-60">{seconds>0?`Resend available in ${seconds}s`:message.startsWith('Code sent')?'Resend verification code':'Send verification code'}</button>{message&&<p role="status" className="text-sm text-primary">{message}</p>}<form onSubmit={submit} className="flex flex-col gap-4"><Field label="Verification code" inputMode="numeric" maxLength={6} placeholder="6-digit code" value={code} onChange={(e:any)=>setCode(e.target.value.replace(/\D/g,''))} error={error}/><button disabled={busy||code.length!==6} className="rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">{busy?'Verifying…':'Verify number'}</button></form><Link href="/home" className="text-center text-sm font-bold text-primary">Return to {siteName}</Link></div></AuthFrame> }
export function ForgotPasswordForm() {
  const [seconds, setSeconds] = useState(0)
  const [message, setMessage] = useState('')
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<{ email: string }>({ resolver: zodResolver(forgotPasswordSchema) })

  useEffect(() => {
    if (seconds === 0) return
    const timer = window.setTimeout(() => setSeconds((remaining) => Math.max(0, remaining - 1)), 1000)
    return () => window.clearTimeout(timer)
  }, [seconds])

  const submit = handleSubmit(async ({ email: address }) => {
    setMessage('')
    setSeconds(60)
    const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || window.location.origin).replace(/\/+$/, '')
    await createClient().auth.resetPasswordForEmail(address.trim(), {
      redirectTo: `${siteUrl}/auth/callback?next=/reset-password`,
    }).catch(() => null)
    setMessage('If an account exists for that email, we sent a reset link')
  })

  return <AuthFrame title="Reset your password" subtitle="Enter the email address on your account and we’ll send you a secure reset link.">
    <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
      <Field label="Email" type="email" placeholder="you@example.com" autoComplete="email" {...register('email')} error={errors.email?.message?.toString()} />
      {message && <p role="status" aria-live="polite" className="text-sm text-muted-foreground">{message}</p>}
      <button disabled={isSubmitting || seconds > 0} className="mt-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">
        {seconds > 0 ? `Resend in ${seconds}s` : 'Send reset link'}
      </button>
      <Link href="/login" className="text-center text-sm font-bold text-primary">Back to login</Link>
    </form>
  </AuthFrame>
}

export function ResetPasswordForm() {
  const router = useRouter()
  const [sessionState, setSessionState] = useState<'checking' | 'ready' | 'missing'>('checking')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const supabase = createClient()
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<{ password: string; confirmPassword: string }>({ resolver: zodResolver(resetPasswordSchema) })
  const password = watch('password', '')
  const strengthScore = [password.length >= 10, /[a-z]/.test(password), /[A-Z]/.test(password), /\d/.test(password), /[^a-zA-Z0-9]/.test(password)].filter(Boolean).length
  const strengthHint = !password
    ? 'Use at least 10 characters. A mix of letters, numbers, and symbols makes it stronger.'
    : strengthScore >= 4
      ? 'Strong password. Avoid reusing passwords from other sites.'
      : 'Add uppercase and lowercase letters, a number, or a symbol to make it stronger.'

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionState(session ? 'ready' : 'missing')
    })
    return () => subscription.unsubscribe()
  }, [supabase])

  const submit = handleSubmit(async ({ password: newPassword }) => {
    setError('')
    setSuccess('')
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword })
      if (updateError) {
        setError('Unable to update your password. Your reset link may have expired; request a new one and try again.')
        return
      }
      const { error: signOutError } = await supabase.auth.signOut()
      if (signOutError) {
        setError('Your password was updated, but we could not sign you out. Please sign out and sign in again.')
        return
      }
      setSuccess('Your password has been updated. Redirecting to login…')
      window.setTimeout(() => router.replace('/login'), 1400)
    } catch {
      setError('Unable to update your password. Your reset link may have expired; request a new one and try again.')
    }
  })

  if (sessionState === 'checking') {
    return <AuthFrame title="Checking your reset link" subtitle="Please wait while we verify your recovery session."><p className="mt-7 text-sm text-muted-foreground">Checking your recovery session…</p></AuthFrame>
  }

  if (sessionState === 'missing') {
    return <AuthFrame title="Reset link expired" subtitle="This link expired. Request a new one to choose a new password.">
      <div className="mt-7 flex flex-col gap-4">
        <Link href="/forgot-password" className="rounded-xl bg-primary py-3.5 text-center font-bold text-primary-foreground">Request a new reset link</Link>
        <Link href="/login" className="text-center text-sm font-bold text-primary">Back to login</Link>
      </div>
    </AuthFrame>
  }

  return <AuthFrame title="Choose a new password" subtitle="Create a new password for your account.">
    <form onSubmit={submit} className="mt-7 flex flex-col gap-4">
      <Field label="New password" type="password" autoComplete="new-password" placeholder="At least 10 characters" {...register('password')} error={errors.password?.message?.toString()} />
      <p aria-live="polite" className="-mt-2 text-xs text-muted-foreground">Password strength: {strengthHint}</p>
      <Field label="Confirm new password" type="password" autoComplete="new-password" placeholder="Re-enter your password" {...register('confirmPassword')} error={errors.confirmPassword?.message?.toString()} />
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      {success && <p role="status" aria-live="polite" className="text-sm text-primary">{success}</p>}
      <button disabled={isSubmitting} className="mt-2 rounded-xl bg-primary py-3.5 font-bold text-primary-foreground disabled:opacity-60">Update password</button>
      <Link href="/login" className="text-center text-sm font-bold text-primary">Back to login</Link>
    </form>
  </AuthFrame>
}
