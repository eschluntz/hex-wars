
# Advance Wars Damage

https://awbw.fandom.com/wiki/Damage_Formula

`Damage% = (B * Av / 100 + L - Lb) * (HPa / 10) * (200 - (Dv + Dtr * HPd)) / 100`

Damage% = Actual damage, expressed as a percentage
B = Base damage against that unit (see the table below)
Av = Attacking unit attack value (eg: 110 for Hawke, +10 for each owned Comm Tower)
L = Luck damage, defaulting to a random number between 0 and 9
Lb = Bad luck damage, where applicable
HPa = Visual HP of attacker (the displayed number from Hitpoints 1-10)
Dv = Defending unit defense value (eg: 80 for Grimm)
Dtr = Defending terrain stars (e.g. Terrain Stars1 for Plains, Terrain Stars2 for Woods)
HPd = Visual HP of defender (the displayed number from Hitpoints 1-10)

# Base Damage chart
Row is the attacker
Column is the defender

	GEAnti-Air	GEAPC	GEArtillery	GEB-Copter	GEBattleship	GEBlack Boat	GEBlack Bomb	GEBomber	GECarrier	GECruiser	GEFighter	GEInfantry	GELander	GEMd. Tank	GEMech	GEMega Tank	GEMissile	GENeotank	GEPiperunner	GERecon	GERocket	GEStealth	GESub	GET-Copter	GETank
GEAnti-Air	45	50	50	120	-	-	120	75	-	-	65	105	-	10	105	1	55	5	25	60	55	75	-	120	25
GEAPC	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEArtillery	75	70	75	-	40	55	-	-	45	65	-	90	55	45	85	15	80	40	70	80	80	-	60	-	70
GEB-Copter	25	60	65	-	25	25	-	-	25	55	-	-	25	25	-	10	65	20	55	55	65	-	25	-	55
GEBattleship	85	80	80	-	50	95	-	-	60	95	-	95	95	55	90	25	90	50	80	90	85	-	95	-	80
GEBlack Boat	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEBlack Bomb	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEBomber	95	105	105	-	75	95	-	-	75	85	-	110	95	95	110	35	105	90	105	105	105	-	95	-	105
GECarrier	-	-	-	115	-	-	120	100	-	-	100	-	-	-	-	-	-	-	-	-	-	100	-	115	-
GECruiser	-	-	-	-	-	25	-	-	5	-	-	-	-	-	-	-	-	-	-	-	-	-	90	-	-
GEFighter	-	-	-	100	-	-	120	100	-	-	55	-	-	-	-	-	-	-	-	-	-	85	-	100	-
GEInfantry	5	12	15	7	-	-	-	-	-	-	-	55	-	1	45	1	25	1	5	12	25	-	-	30	5
GELander	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEMd. Tank	105	105	105	-	10	35	-	-	10	45	-	-	35	55	-	25	105	45	85	105	105	-	10	-	85
GEMech	65	75	70	-	-	-	-	-	-	-	-	-	-	15	-	5	85	15	55	85	85	-	-	-	55
GEMega Tank	195	195	195	-	45	105	-	-	45	65	-	-	75	125	-	65	195	115	180	195	195	-	45	-	180
GEMissile	-	-	-	120	-	-	120	100	-	-	100	-	-	-	-	-	-	-	-	-	-	100	-	120	-
GENeotank	115	125	115	-	15	40	-	-	15	50	-	-	40	75	-	35	125	55	105	125	125	-	15	-	105
GEPiperunner	85	80	80	105	55	60	120	75	60	60	65	95	60	55	90	25	90	50	80	90	85	75	85	105	80
GERecon	4	45	45	10	-	-	-	-	-	-	-	70	-	1	65	1	28	1	6	35	55	-	-	35	6
GERocket	85	80	80	-	55	60	-	-	60	85	-	95	60	55	90	25	90	50	80	90	85	-	85	-	80
GEStealth	50	85	75	85	45	65	120	70	45	35	45	90	65	70	90	15	85	60	80	85	85	55	55	95	75
GESub	-	-	-	-	55	95	-	-	75	25	-	-	95	-	-	-	-	-	-	-	-	-	55	-	-
GET-Copter	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GETank	65	75	70	-	1	10	-	-	1	5	-	-	10	15	-	10	85	15	55	85	85	-	1	-	55


# Secondary Damage Chart 

	GEAnti-Air	GEAPC	GEArtillery	GEB-Copter	GEBattleship	GEBlack Boat	GEBlack Bomb	GEBomber	GECarrier	GECruiser	GEFighter	GEInfantry	GELander	GEMd. Tank	GEMech	GEMega Tank	GEMissile	GENeotank	GEPiperunner	GERecon	GERocket	GEStealth	GESub	GET-Copter	GETank
GEAnti-Air	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEAPC	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEArtillery	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEB-Copter	6	20	25	65	-	-	-	-	-	-	-	75	-	1	75	1	35	1	6	30	35	-	-	95	6
GEBattleship	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEBlack Boat	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEBlack Bomb	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEBomber	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GECarrier	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GECruiser	-	-	-	115	-	-	120	65	-	-	55	-	-	-	-	-	-	-	-	-	-	100	-	115	-
GEFighter	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEInfantry	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GELander	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEMd. Tank	7	45	45	12	-	-	-	-	-	-	-	105	-	1	95	1	35	1	8	45	45	-	-	45	8
GEMech	6	20	32	9	-	-	-	-	-	-	-	65	-	1	55	1	35	1	6	18	35	-	-	35	6
GEMega Tank	17	65	65	22	-	-	-	-	-	-	-	135	-	1	125	1	55	1	10	65	75	-	-	55	10
GEMissile	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GENeotank	17	65	65	22	-	-	-	-	-	-	-	125	-	1	115	1	55	1	10	65	75	-	-	55	10
GEPiperunner	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GERecon	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GERocket	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GEStealth	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GESub	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GET-Copter	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-	-
GETank	5	54	45	10	-	-	-	-	-	-	-	75	-	1	70	1	30	1	6	40	55	-	-	40	6
