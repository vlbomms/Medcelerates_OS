import bcrypt from 'bcrypt';

export const hashPassword = async (password: string): Promise<string> => {
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  console.log('Password hashing:', {
    originalLength: password.length,
    hashedLength: hashedPassword.length
  });
  
  return hashedPassword;
};

export const comparePassword = async (password: string, hashedPassword: string): Promise<boolean> => {
  console.log('Password comparison:', {
    inputPasswordLength: password.length,
    hashedPasswordLength: hashedPassword.length,
    hashedPasswordStart: hashedPassword.substring(0, 10) + '...'
  });

  const isMatch = await bcrypt.compare(password, hashedPassword);
  
  console.log('Password comparison result:', {
    match: isMatch
  });

  return isMatch;
};