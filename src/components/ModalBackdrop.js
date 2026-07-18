import { Modal, Pressable, StyleSheet } from 'react-native';

// Shared by every bottom-sheet modal in the app: renders the dimmed
// backdrop and closes on outside tap.
export default function ModalBackdrop({ visible, onRequestClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose} testID="modal-backdrop">
        {children}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'flex-end',
  },
});
