export function friendlyError(error) {
  if (!error) return 'Something went wrong. Please try again.'
  const msg = (error.message || error.toString()).toLowerCase()

  // Auth errors
  if (msg.includes('invalid login credentials') || msg.includes('invalid password') || msg.includes('wrong password'))
    return 'Incorrect email or password. Please try again.'
  if (msg.includes('user already registered') || msg.includes('already been registered') || msg.includes('already exists'))
    return 'An account with this email already exists. Try logging in instead.'
  if (msg.includes('email not confirmed'))
    return 'Please verify your email first. Check your inbox for a confirmation link.'
  if (msg.includes('password should be at least') || msg.includes('password is too short') || msg.includes('at least 6'))
    return 'Password must be at least 6 characters.'
  if (msg.includes('unable to validate email') || msg.includes('invalid email'))
    return 'Please enter a valid email address.'
  if (msg.includes('jwt expired') || msg.includes('token is expired') || msg.includes('session_not_found'))
    return 'Your session has expired. Please log in again.'
  if (msg.includes('signup is disabled'))
    return 'New sign-ups are currently disabled. Please contact the admin.'

  // RLS / permission errors
  if (msg.includes('row-level security') || msg.includes('violates rls') || msg.includes('new row violates'))
    return 'Action not permitted. If this keeps happening, please contact the admin.'
  if (msg.includes('not authorised to record'))
    return 'You must be one of the players in this match to record the result.'
  if (msg.includes('permission denied'))
    return 'You don\'t have permission to do that.'

  // Constraint errors
  if (msg.includes('duplicate key') || msg.includes('unique constraint'))
    return 'This record already exists.'
  if (msg.includes('foreign key') || msg.includes('violates foreign key'))
    return 'This action references a record that doesn\'t exist. Please refresh and try again.'
  if (msg.includes('not null') || msg.includes('null value'))
    return 'Please fill in all required fields.'

  // Network errors
  if (msg.includes('failed to fetch') || msg.includes('network') || msg.includes('fetch'))
    return 'Connection error. Please check your internet and try again.'

  // Generic fallback
  return 'Something went wrong. Please try again or contact the admin.'
}
