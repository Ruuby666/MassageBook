import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet } from 'react-native';
import { colors } from '../theme';

export default function FloatingActionButton({
  onPress,
  icon = 'lock-closed',
  bottomOffset = 28,
  testID,
}) {
  return (
    <Pressable
      style={[styles.fab, { bottom: bottomOffset }]}
      onPress={onPress}
      hitSlop={8}
      testID={testID}
    >
      <Ionicons name={icon} size={24} color={colors.surface} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4,
  },
});
