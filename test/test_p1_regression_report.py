import unittest
from scripts.p1_compare_real_dwg import compare_validation


class CompareRealDwgTests(unittest.TestCase):
    def baseline(self):
        return {
            'provider':'acadsharp','ifc_exported':True,'ifc_sanity_passed':True,'passed':True,
            'import_coverage':0.965,'converted_entities':70422,'unsupported_entities':2554,
            'element_counts':{'pipe':739,'fitting':605,'wall':237},'review_pending_count':1312
        }

    def test_native_ifc_validated_and_same_geometry_raises_no_regression_flag(self):
        report=compare_validation(self.baseline(),self.baseline(),source='QUA')
        self.assertTrue(report['technical_gate_passed'])
        self.assertFalse(report['warnings'])
        self.assertTrue(report['needs_engineer_review']) # pending manual review

    def test_changed_numbers_are_flagged_without_declaring_false_precision(self):
        current=self.baseline() | {'import_coverage':0.94,'element_counts':{'pipe':200,'fitting':605,'wall':237}}
        report=compare_validation(current,self.baseline())
        self.assertIn('cobertura_importacao_reduzida_mais_1pp',report['warnings'])
        self.assertIn('pipe_count_drop_gt_20pct',report['warnings'])
        self.assertNotIn('recognition_accuracy',report)
        self.assertTrue(report['technical_gate_passed'])

    def test_export_failure_does_not_pass_gate(self):
        report=compare_validation(self.baseline() | {'ifc_sanity_passed':False},self.baseline())
        self.assertFalse(report['technical_gate_passed'])


if __name__=='__main__':
    unittest.main()
