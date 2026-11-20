import { Redirect } from 'expo-router';
import { STUDENT_HOME } from '@/constants/studentTheme';

/** Old student home URL: the student area now lives under /student (bottom tabs). */
export default function PortfolioRedirect() {
  return <Redirect href={STUDENT_HOME} />;
}
