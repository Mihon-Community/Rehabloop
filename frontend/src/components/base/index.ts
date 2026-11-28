/**
 * Project-native UI primitives.
 *
 * These replace a set of vendored component-library files. They keep the same
 * props the screens were already written against, but carry no third-party
 * runtime: variants are plain class maps (see ./variants), `asChild` is a
 * nine-line clone instead of a slot package, and every icon is inline SVG
 * from @/components/icon.
 */
export { Alert, AlertDescription, AlertTitle, type AlertProps } from './Alert';
export { Badge, type BadgeProps, type BadgeVariant } from './Badge';
export {
  Button,
  buttonClasses,
  type ButtonProps,
  type ButtonSize,
  type ButtonVariant,
} from './Button';
export {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type CardHeaderProps,
  type CardProps,
} from './Card';
export { Input, Textarea } from './Field';
export {
  NotificationList,
  type NotificationListProps,
  type StackNotification,
} from './NotificationList';
export {
  SettingsStack,
  type SettingsStackProps,
  type StackPage,
  type StackRow,
  type StackSection,
} from './SettingsStack';
export { pickVariants, type VariantMap, type VariantProps } from './variants';
