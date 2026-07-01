import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { wa } from '../../lib/clinic';

export default function WhatsAppFAB() {
  return (
    <motion.a
      href={wa.info()}
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-8 right-8 z-50 bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-full shadow-lg shadow-[#25D366]/30 transition-colors group"
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ delay: 2, type: 'spring', stiffness: 200 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
    >
      <MessageCircle size={24} />
      <span className="absolute right-full mr-4 px-3 py-1.5 bg-on-background text-white text-xs font-bold rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">WhatsApp</span>
    </motion.a>
  );
}
