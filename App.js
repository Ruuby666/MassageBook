import { StatusBar } from 'expo-status-bar';
import CalendarScreen from './src/screens/CalendarScreen';

export default function App() {
  return (
    <>
      <CalendarScreen />
      <StatusBar style="auto" />
    </>
  );
}
