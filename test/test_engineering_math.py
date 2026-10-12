import json
import os
import sys
import unittest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'modules'))
from compatibilizabim.engineering_math import calculate


class EngineeringMathTests(unittest.TestCase):
    def test_symbolic_derivative_and_critical_points(self):
        result = calculate({'expression':'x*(5-x)*6', 'operation':'analyze','lower':0,'upper':5})
        self.assertEqual(result['derivative'], '30 - 12*x')
        self.assertTrue(any(abs(p['x']-2.5)<1e-6 for p in result['critical_points']))
        self.assertEqual(len(result['points']),61)

    def test_integral_definite(self):
        result = calculate({'expression':'2*x', 'operation':'integrate', 'lower':0, 'upper':3})
        self.assertAlmostEqual(result['numeric_result'],9)

    def test_blocks_code_execution(self):
        with self.assertRaises(ValueError):
            calculate({'expression':"__import__('os').system('id')",'operation':'analyze'})
        with self.assertRaises(ValueError):
            calculate({'expression':'x**999999999','operation':'analyze'})
        with self.assertRaises(ValueError):
            calculate({'expression':'x + y','operation':'analyze'})

    def test_rejects_large_domain(self):
        with self.assertRaises(ValueError):
            calculate({'expression':'x','operation':'analyze','lower':1e100,'upper':2e100})

if __name__ == '__main__':
    unittest.main()
