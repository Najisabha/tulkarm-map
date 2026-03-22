import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../../context/AuthContext';
import { shadow } from '../../utils/shadowStyles';

export default function RegisterScreen() {
  const router = useRouter();
  const { register, loginAsGuest } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name.trim() || !email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('تنبيه', 'يرجى تعبئة جميع الحقول');
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert('خطأ', 'كلمتا المرور غير متطابقتين');
      return;
    }
    setLoading(true);
    const result = await register(name, email, password);
    setLoading(false);
    if (result.success) {
      router.replace('/(main)/map');
    } else {
      Alert.alert('خطأ', result.message);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Text style={styles.backButtonText}>→ العودة</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>✨</Text>
          </View>
          <Text style={styles.title}>إنشاء حساب جديد</Text>
          <Text style={styles.subtitle}>انضم لمجتمع طولكرم اليوم</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.inputGroup}>
            <Text style={styles.label}>الاسم الكامل</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="أدخل اسمك الكامل"
                placeholderTextColor="#9CA3AF"
                value={name}
                onChangeText={setName}
                textAlign="right"
              />
              <Text style={styles.inputIcon}>👤</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>البريد الإلكتروني</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="أدخل بريدك الإلكتروني"
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                textAlign="right"
              />
              <Text style={styles.inputIcon}>📧</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>كلمة المرور</Text>
            <View style={styles.inputContainer}>
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Text style={styles.inputIcon}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="6 أحرف على الأقل"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                textAlign="right"
              />
              <Text style={styles.inputIcon}>🔒</Text>
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>تأكيد كلمة المرور</Text>
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                placeholder="أعد إدخال كلمة المرور"
                placeholderTextColor="#9CA3AF"
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry={!showPassword}
                textAlign="right"
              />
              <Text style={styles.inputIcon}>🔐</Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.registerButton, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.registerButtonText}>إنشاء الحساب</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.loginLink}
            onPress={() => router.back()}
          >
            <Text style={styles.loginLinkText}>لديك حساب بالفعل؟ تسجيل الدخول</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={async () => {
              await loginAsGuest();
              router.replace('/(main)/map');
            }}
          >
            <Text style={styles.guestButtonText}>زائر</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#EBF5FB',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 50,
  },
  backButton: {
    marginBottom: 16,
  },
  backButtonText: {
    color: '#2E86AB',
    fontSize: 16,
    fontWeight: '600',
  },
  header: {
    alignItems: 'center',
    marginBottom: 28,
  },
  logoContainer: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: '#2E86AB',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 6 }),
  },
  logoEmoji: {
    fontSize: 32,
  },
  title: {
    fontSize: 26,
    fontWeight: '800',
    color: '#1A3A5C',
  },
  subtitle: {
    fontSize: 14,
    color: '#4A7FA5',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    ...shadow({ offset: { width: 0, height: 4 }, opacity: 0.1, radius: 12, elevation: 5 }),
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'right',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
  },
  input: {
    flex: 1,
    paddingVertical: 13,
    fontSize: 15,
    color: '#1F2937',
  },
  inputIcon: {
    fontSize: 18,
    marginLeft: 8,
  },
  registerButton: {
    backgroundColor: '#2E86AB',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
    ...shadow({ color: '#2E86AB', offset: { width: 0, height: 4 }, opacity: 0.3, radius: 8, elevation: 4 }),
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  registerButtonText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
  },
  loginLink: {
    alignItems: 'center',
    marginTop: 18,
    paddingVertical: 10,
  },
  loginLinkText: {
    color: '#2E86AB',
    fontSize: 14,
    fontWeight: '600',
  },
  guestButton: {
    marginTop: 16,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    backgroundColor: '#F1F5F9',
  },
  guestButtonText: {
    color: '#64748B',
    fontSize: 15,
    fontWeight: '600',
  },
});
