import React from 'react';
import { I18nManager, StyleProp, Text, TouchableOpacity, View, ViewStyle } from 'react-native';
import { mapStyles as styles } from './styles';

interface BottomSheetFrameProps {
  onBackdropPress?: () => void;
  /** Disable pointer events on the backdrop (web/windows focus quirk). */
  inertBackdrop?: boolean;
  /** Override the sheet container style (defaults to `storeModal`). */
  sheetStyle?: StyleProp<ViewStyle>;
  /** Optional header slot rendered above `children` with a drag handle. */
  header?: React.ReactNode;
  /** Optional close button shown on the left of the header. */
  onClose?: () => void;
  /** Optional emoji shown in the header emoji circle. */
  headerEmoji?: string;
  /** Optional title in the header row (between close and emoji), e.g. place name. */
  headerTitle?: string;
  /** Optional circle background color (accepts hex + alpha suffix). */
  headerEmojiBackground?: string;
  /** Hide the default drag handle. */
  hideHandle?: boolean;
  children: React.ReactNode;
}

/**
 * Shared overlay + backdrop + rounded sheet used by every bottom sheet on the
 * map screen (store details, travel wizard, tap options, category sheet, …).
 */
export function BottomSheetFrame({
  onBackdropPress,
  inertBackdrop = false,
  sheetStyle,
  header,
  onClose,
  headerEmoji,
  headerTitle,
  headerEmojiBackground,
  hideHandle,
  children,
}: BottomSheetFrameProps) {
  /** RTL: [close, title, emoji] → إغلاق يمين، أيقونة يسار. LTR: نعكس اتجاه الصف لنفس الترتيب البصري. */
  const headerRowStyle = I18nManager.isRTL ? styles.storeModalHeader : styles.storeModalHeaderLtr;

  return (
    <View style={styles.overlayContainer} pointerEvents="box-none">
      {inertBackdrop ? (
        <View style={styles.overlayBackdrop} pointerEvents="none" />
      ) : (
        <TouchableOpacity
          style={styles.overlayBackdrop}
          onPress={onBackdropPress}
          activeOpacity={1}
        />
      )}
      <View style={[styles.storeModal, sheetStyle]} pointerEvents="auto">
        {!hideHandle && <View style={styles.storeModalHandle} />}
        {(onClose || headerEmoji) && (
          <View style={headerRowStyle}>
            {onClose ? (
              <TouchableOpacity style={styles.closeModalBtn} onPress={onClose}>
                <Text style={styles.closeModalBtnText}>✕</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.closeModalBtn} />
            )}
            <View style={styles.storeModalHeaderTitleWrap}>
              {headerTitle ? (
                <Text style={styles.storeModalHeaderTitle} numberOfLines={2}>
                  {headerTitle}
                </Text>
              ) : null}
            </View>
            {headerEmoji ? (
              <View
                style={[
                  styles.storeModalEmojiCircle,
                  headerEmojiBackground ? { backgroundColor: headerEmojiBackground } : null,
                ]}
              >
                <Text style={styles.storeModalEmoji}>{headerEmoji}</Text>
              </View>
            ) : (
              <View style={styles.storeModalHeaderEmojiSpacer} />
            )}
          </View>
        )}
        {header}
        {children}
      </View>
    </View>
  );
}
