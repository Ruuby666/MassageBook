import { Modal, Pressable, StyleSheet, View } from 'react-native';

// Shared by every bottom-sheet modal in the app: renders the dimmed
// backdrop and closes on outside tap.
export default function ModalBackdrop({ visible, onRequestClose, children }) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onRequestClose}>
      <Pressable style={styles.backdrop} onPress={onRequestClose} testID="modal-backdrop">
        {/* Same size as the backdrop (not a percentage of it) so each
        sheet's own maxHeight: '90%'/'85%' style keeps resolving against the
        full screen like before. pointerEvents="box-none" lets taps in the
        empty area above the sheet still fall through to the backdrop's
        onPress above, so "tap outside to close" keeps working. */}
        <View style={styles.sheetWrapper} pointerEvents="box-none">
          {/* Stops the tap from bubbling to the backdrop above — on native
          RN's responder system already isolates this, but react-native-web
          fires onPress via bubbling DOM click events, so without this any
          tap inside the sheet (e.g. a TextInput) closed the modal on web. */}
          <Pressable onPress={() => {}} style={styles.sheetWrapper}>
            {children}
          </Pressable>
        </View>
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
  sheetWrapper: {
    flex: 1,
    width: '100%',
    justifyContent: 'flex-end',
  },
});
