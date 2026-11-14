# -*- coding: utf-8 -*-
"""Regras da etapa 0g: o que o Overture traz de errado e precisa ficar de fora.

Os casos são reais, de São Carlos (out/2026).
"""
import unittest

from pipeline.fontes.pois_overture import Grade, categoria


def h(*nos):
    return set(nos)


class CategoriaTests(unittest.TestCase):
    def test_clinic_tagged_hospital_is_dropped(self):
        self.assertIsNone(categoria("Clínica Cencic", h("health_care", "hospital")))
        self.assertEqual(categoria("Norden Hospital", h("health_care", "hospital")), "hospital")
        self.assertEqual(categoria("UPA Vila Prado", h("health_care", "hospital")), "upa")

    def test_warehouse_club_is_not_wholesale_unless_known_chain(self):
        self.assertEqual(categoria("Monaco Roupas no Atacado",
                                   h("shopping", "warehouse_club_store")), "loja")
        self.assertEqual(categoria("Tenda Atacado",
                                   h("shopping", "warehouse_club_store")), "atacado")

    def test_grocery_split(self):
        g = h("shopping", "grocery_store")
        self.assertEqual(categoria("Dia Supermercado", g), "supermercado")
        self.assertEqual(categoria("Atacadão SA", g), "atacado")
        self.assertEqual(categoria("Empório Bonura", h("wholesale_grocer")), "mercado")

    def test_student_house_is_not_a_butcher(self):
        self.assertIsNone(categoria("República Santa Casa",
                                    h("shopping", "food_and_beverage_store", "butcher_shop")))


class DuplicataTests(unittest.TestCase):
    def test_misspelled_copy_156m_away_is_the_same_store(self):
        g = Grade()
        g.add(-22.00500, -47.89000, "carrefour")
        self.assertTrue(g.tem(-22.00640, -47.89000, "carefour"))     # ~156 m
        self.assertFalse(g.tem(-22.00800, -47.89000, "carefour"))    # ~334 m
        self.assertFalse(g.tem(-22.00510, -47.89000, "dia supermercado"))


if __name__ == "__main__":
    unittest.main()
